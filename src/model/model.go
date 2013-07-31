package model

import (
	"bytes"
	"errors"
	"fmt"
	"log"
	"util"
)
import db "code.google.com/p/couch-go"
import ldap "github.com/tonnerre/go-ldap"

const applicationsSuffix = "_applications"
const reviewersSuffix = "_reviewers"
const commentsSuffix = "_comments"
const highlightsSuffix = "_highlights"
const scoresSuffix = "_scores"

var dbSuffixes = [...]string{applicationsSuffix, reviewersSuffix, commentsSuffix,
	highlightsSuffix, scoresSuffix}

var includeDocs = map[string](interface{}){"include_docs": true}

type URL struct {
	Text *string `json:"text"`
	URL  *string `json:"url"`
}

type ReviewerId string

type Application struct {
	EmbarkId     string    `json:"embarkId"`
	FirstName    *string   `json:"firstName"`
	LastName     *string   `json:"lastName"`
	Email        *string   `json:"url"`
	GPA          *float64  `json:"GPA"`
	GREMath      *float64  `json:"GREMath"`
	GREVerbal    *float64  `json:"GREVerbal"`
	Country      *string   `json:"country"`
	Areas        *[]string `json:"areas"`
	Materials    []URL     `json:"materials"`
	Recs         []URL     `json:"recs"`
	ExpectedRecs *int      `json:"expectedRecCount"`
}

type Reviewer struct {
	Id           ReviewerId `json:"_id"`
	Name         string     `json:"name"`
	PasswordHash []byte     `json:"passwordHash"`
}

// Reviewers can post multiple comments on applicants. 
type Comment struct {
	ApplicantId  string     `json:"appId"`
	ReviewerId   ReviewerId `json:"reviewerId"`
	ReviewerName string     `json:"reviewerName"`
	Timestamp    float64    `json:"timestamp"`
	Text         string     `json:"text"`
}

// A highlight on an application is a mark set by one reviewer, the writer, for
// another reviewer, the reader.
type Highlight struct {
	ApplicationId string     `json:"appId"`
	ReaderId      ReviewerId `json:"readerId"`
	WriterId      ReviewerId `json:"writerId"`
	WriterName    string     `json:"writerName"`
	Timestamp     float64    `json:"timestamp"`
}

// A score is a (number, label) pair set by a reviewer on an application. 
type Score struct {
	AppId string     `json:"appId"`
	RevId ReviewerId `json:"revId"`
	Label string     `json:"label"`
	Score *int       `json:"score"`
}

type Dept struct {
	couchPrefix  string
	appDB        *db.Database
	reviewerDB   *db.Database
	commentsDB   *db.Database
	highlightsDB *db.Database
	scoresDB     *db.Database
}

type CommentRow struct {
	Doc Comment `json:"doc"`
}

type CommentsResult struct {
	Rows []CommentRow `json:"rows"`
}

type HighlightsByAppResult struct {
	Rows []struct {
		Key   string `json:"key"`
		Value struct {
			Id       string `json:"_id"`
			Rev      string `json:"_rev"`
			ReaderId string `json:"readerId"`
		} `json:"value"`
	} `json:"rows"`
}

func (self *Dept) databases() []*db.Database {
	return ([]*db.Database{self.appDB, self.reviewerDB, self.commentsDB,
		self.highlightsDB, self.scoresDB})
}

func NewDept(host string, port string, prefix string) (dept *Dept, err error) {
	_, err = db.NewDatabase(host, port, prefix+applicationsSuffix)
	if err != nil {
		return nil, err
	}
	_, err = db.NewDatabase(host, port, prefix+reviewersSuffix)
	if err != nil {
		return nil, err
	}
	commentsDB, err := db.NewDatabase(host, port, prefix+commentsSuffix)
	if err != nil {
		return nil, err
	}
	highlightsDB, err := db.NewDatabase(host, port, prefix+highlightsSuffix)
	if err != nil {
		return nil, err
	}
	commentsDesign := map[string]interface{}{
		"_id":      "_design/myviews",
		"language": "javascript",
		"views": map[string]interface{}{
			"byAppId": map[string]interface{}{
				"map": `function(doc) { emit(doc.appId, doc); }`,
			},
		},
	}
	_, _, err = commentsDB.Insert(commentsDesign)
	if err != nil {
		return nil, err
	}
	highlightsDesign := map[string]interface{}{
		"_id":      "_design/myviews",
		"language": "javascript",
		"views": map[string]interface{}{
			"byReader": map[string]interface{}{
				"map": `function(doc) { emit(doc.readerId, { writerId: doc.writerId, appId: doc.appId }); }`,
			},
			"byApp": map[string]interface{}{
				"map": `function(doc) { emit(doc.appId, { _rev: doc._rev, _id: doc._id, readerId: doc.readerId }); }`,
			},
		},
	}
	_, _, err = highlightsDB.Insert(highlightsDesign)
	if err != nil {
		return nil, err
	}

	const averagesMap = `function(doc) {
    var r = { };
    r[doc.label] = { sum: doc.score, len: 1, avg: doc.score };
    emit(doc.appId, r);
  }`
	const averagesReduce = `function (key, values, rereduce) {
    var r = { };
    for (var i = 0; i < values.length; i++) {
      for (var label in values[i]) {
        if (!values[i].hasOwnProperty(label)) {
          continue;
        }
        if (!r.hasOwnProperty(label)) {
          r[label] = { sum: 0, len: 0 };
        }
        r[label].sum += values[i][label].sum;
        r[label].len += values[i][label].len;
        r[label].avg = r[label].sum / r[label].len;
      }
    }
    return r;
  }`

	scoresDB, err := db.NewDatabase(host, port, prefix+scoresSuffix)
	if err != nil {
		return nil, err
	}
	scoresDesign := map[string]interface{}{
		"_id":      "_design/myviews",
		"language": "javascript",
		"views": map[string]interface{}{
			"byId": map[string]interface{}{
				"map": `function(doc) { emit(doc._id, doc); }`,
			},
			"averages": map[string]interface{}{
				"map":    averagesMap,
				"reduce": averagesReduce,
			},
		},
	}
	_, _, err = scoresDB.Insert(scoresDesign)
	if err != nil {
		return nil, err
	}

	dept, err = LoadDept(host, port, prefix)
	return
}

func LoadDept(host string, port string, prefix string) (*Dept, error) {
	appDb, error := db.NewDatabase(host, port, prefix+applicationsSuffix)
	if error != nil {
		return nil, error
	}
	reviewerDb, error := db.NewDatabase(host, port, prefix+reviewersSuffix)
	if error != nil {
		return nil, error
	}
	commentsDb, error := db.NewDatabase(host, port, prefix+commentsSuffix)
	if error != nil {
		return nil, error
	}
	highlightsDb, error := db.NewDatabase(host, port, prefix+highlightsSuffix)
	if error != nil {
		return nil, error
	}
	scoresDb, error := db.NewDatabase(host, port, prefix+scoresSuffix)
	if error != nil {
		return nil, error
	}

	dept := &Dept{prefix, &appDb, &reviewerDb, &commentsDb, &highlightsDb,
		&scoresDb}
	for _, deptDB := range dept.databases() {
		if !deptDB.Exists() {
			return nil, errors.New(fmt.Sprintf("database %v missing", deptDB.Name))
		}
	}
	return dept, nil
}

func (self *Dept) Delete() {
	for _, deptDB := range self.databases() {
		if deptDB != nil {
			deptDB.DeleteDatabase()
		}
	}
}

func (self *Dept) Applications(revId string) ([]map[string]interface{},
	error) {
	var apps map[string]interface{}
	err := self.appDB.Query("_all_docs", includeDocs, &apps)
	if err != nil {
		return nil, err
	}
	var scores map[string]interface{}
	err = self.scoresDB.Query("_design/myviews/_view/byId",
		includeDocs, &scores)
	if err != nil {
		return nil, err
	}
	var highlights struct {
		Rows []struct {
			Value struct {
				WriterId string `json:"writerId"`
				AppId    string `json:"appId"`
			}
		}
	}
	err = self.highlightsDB.Query("_design/myviews/_view/byReader",
		map[string]interface{}{"key": revId}, &highlights)
	if err != nil {
		return nil, err
	}
	var avgs struct {
		Rows []struct {
			Key   string
			Value map[string]struct {
				Avg float64
			}
		}
	}
	err = self.scoresDB.Query("_design/myviews/_view/averages",
		map[string]interface{}{"group": true}, &avgs)
	if err != nil {
		return nil, err
	}

	appMap := make(map[string]map[string]interface{},
		int(apps["total_rows"].(float64)))
	for _, row := range apps["rows"].([]interface{}) {
		app := row.(map[string]interface{})
		id := app["id"].(string)
		appMap[id] = app["doc"].(map[string]interface{})

		// Workaround bug https://codereview.appspot.com/7196050/    
		if len(appMap[id]["recs"].([]interface{})) == 0 {
			appMap[id]["recs"] = [0]string{}
		}
		if len(appMap[id]["areas"].([]interface{})) == 0 {
			appMap[id]["areas"] = [0]string{}
		}

		appMap[id]["highlight"] = make([]string, 0, 1)
	}
	for _, rawRow := range scores["rows"].([]interface{}) {
		row := rawRow.(map[string]interface{})
		score := row["doc"].(map[string]interface{})
		app := appMap[score["appId"].(string)]
		label := "score_" + score["label"].(string)
		reviewer := score["revId"].(string)
		val := score["score"].(float64)
		scoreMap, found := app[label].(map[string]float64)
		if found {
			scoreMap[reviewer] = val
		} else {
			app[label] = map[string]float64{reviewer: val}
		}
	}
	for _, row := range highlights.Rows {
		prev := appMap[row.Value.AppId]["highlight"].([]string)
		appMap[row.Value.AppId]["highlight"] = append(prev, row.Value.WriterId)
	}
	for _, row := range avgs.Rows {
		for label, value := range row.Value {
			appMap[row.Key]["avgscore_"+label] = value.Avg
		}
	}

	i := 0
	result := make([]map[string]interface{}, len(appMap))
	for _, app := range appMap {
		result[i] = app
		i = i + 1
	}
	return result, err
}

func (self *Dept) NewApplication(app Application) (err error) {
	_, _, err = self.appDB.InsertWith(app, app.EmbarkId)
	return
}

func (self *Dept) NewReviewer(id ReviewerId, name string, pw string) (*Reviewer, error) {
	ret := &Reviewer{Id: id, Name: name, PasswordHash: util.HashString(pw)}
	_, _, err := self.reviewerDB.Insert(*ret)
	if err != nil {
		return nil, err
	}
	return ret, nil
}

func (self *Dept) AuthReviewer(id ReviewerId, pw string) (*Reviewer, error) {
	var rev Reviewer
	_, err := self.reviewerDB.Retrieve(string(id), &rev)
	if err != nil {
		log.Printf("AuthReviewer(%v, _) - user does not exist", id)
		return nil, err
	}
	// If the password is "" (blank), check against LDAP instead
	if bytes.Equal(rev.PasswordHash, util.HashString("")) == true {
		l, err := ldap.DialSSL("tcp", "directory.cs.umass.edu:636")
		if err != nil {
			log.Printf("AuthReviewer(%v, _) - %v", id, err)
			return nil, errors.New("can't connect to ldap server")
		}
		userdn := fmt.Sprintf("uid=%v,cn=users,dc=cs,dc=umass,dc=edu", id)
		err = l.Bind(userdn, pw)
		if err != nil {
			log.Printf("AuthReviewer(%v, _) - %v", id, err)
			return nil, errors.New("invalid password")
		}
	} else if bytes.Equal(rev.PasswordHash, util.HashString(pw)) == false {
		log.Printf("AuthReviewer(%v, _) - incorrect password", id)
		return nil, errors.New("invalid password")
	}
	return &rev, nil
}

func (self *Dept) ReviewerExists(id ReviewerId) bool {
	var rev Reviewer
	_, err := self.reviewerDB.Retrieve(string(id), &rev)
	return err == nil
}

func (self *Dept) ChangePassword(id ReviewerId, pw string) error {
	var user Reviewer
	_rev, err := self.reviewerDB.Retrieve(string(id), &user)
	if err != nil {
		return errors.New("invalid username")
	}
	if len(pw) < 5 {
		return errors.New("password too short (six characters required)")
	}
	user.PasswordHash = util.HashString(pw)
	_, err = self.reviewerDB.EditWith(user, string(id), _rev)
	return err
}

func (self *Dept) GetReviewerById(revId ReviewerId) (*Reviewer, error) {
	var rev Reviewer
	_, err := self.reviewerDB.Retrieve(string(revId), &rev)
	if err != nil {
		return nil, err
	}
	return &rev, nil
}

// NewComment does not authenticate its arguments
func (self *Dept) NewComment(comment *Comment) error {
	_, _, err := self.commentsDB.Insert(comment)
	if err != nil {
		return err
	}
	return nil
}

func (self *Dept) LoadComments(appId string) ([]Comment, error) {
	var result CommentsResult
	query := map[string](interface{}){"key": appId, "include_docs": true}
	err := self.commentsDB.Query("_design/myviews/_view/byAppId", query, &result)

	ret := make([]Comment, len(result.Rows))
	for ix, row := range result.Rows {
		ret[ix] = row.Doc
	}
	return ret, err
}

func (self *Dept) SetHighlight(hl *Highlight) error {
	// XXX: relies on the component ids being non-empty.
	_id := fmt.Sprintf("%s-%s-%s", hl.ApplicationId,
		string(hl.ReaderId), string(hl.WriterId))
	_, _, err := self.highlightsDB.InsertWith(hl, _id)
	return err
}

func (self *Dept) DelHighlight(appId, readerId string) error {
	var r HighlightsByAppResult
	err := self.highlightsDB.Query("_design/myviews/_view/byApp",
		map[string]interface{}{"key": appId}, &r)
	if err != nil {
		return err
	}
	for _, row := range r.Rows {
		if row.Value.ReaderId == readerId {
			// Ignore failures. They may occur due to concurrent update, but that's
			// okay.
			err := self.highlightsDB.Delete(row.Value.Id, row.Value.Rev)
			if err != nil {
				log.Printf("ERROR highlightsDB.Delete(%v, %v) : %v", row.Value.Id,
					row.Value.Rev, err)
			}
		}
	}
	return nil
}

func query(d *db.Database, view string, key string) ([]map[string]interface{},
	error) {
	var r map[string]interface{}
	q := map[string]interface{}{"key": key, "include_docs": false}
	err := d.Query(view, q, &r)
	if err != nil {
		return nil, err
	}
	rows := r["rows"].([]interface{})
	vals := make([]map[string]interface{}, len(rows))
	for i, row := range rows {
		vals[i] = row.(map[string]interface{})["value"].(map[string]interface{})
	}
	return vals, nil
}

func (self *Dept) HighlightsByApp(appId string) ([]string, error) {
	var r HighlightsByAppResult
	err := self.highlightsDB.Query("_design/myviews/_view/byApp",
		map[string]interface{}{"key": appId}, &r)
	if err != nil {
		return nil, err
	}
	arr := make([]string, len(r.Rows))
	for i, row := range r.Rows {
		arr[i] = row.Value.ReaderId
	}
	return arr, nil
}

func (self *Dept) GetReviewerIdMap() (map[string]string, error) {
	var r map[string]interface{}
	err := self.reviewerDB.Query("_all_docs", includeDocs, &r)
	if err != nil {
		return nil, err
	}

	rows := r["rows"].([]interface{})
	result := make(map[string]string, len(rows))
	for _, row := range rows {
		dict := row.(map[string]interface{})
		id := dict["id"].(string)
		name := dict["doc"].(map[string]interface{})["name"].(string)
		result[id] = name
	}
	return result, nil
}

// Create/update/delete the specified score. Signals an error on a concurrent
// update, since _id is constructed.
func (self *Dept) SetScore(score *Score) error {
	// XXX: relies on the component ids being non-empty.
	_id := fmt.Sprintf("%s-%s-%s", score.AppId, score.RevId, score.Label)
	rows, err := query(self.scoresDB, "_design/myviews/_view/byId", _id)
	if len(rows) > 0 {
		_rev := rows[0]["_rev"].(string)
		if score.Score == nil {
			err = self.scoresDB.Delete(_id, _rev)
		} else {
			_, err = self.scoresDB.EditWith(score, _id, _rev)
		}
		return err
	}
	if score.Score == nil {
		return errors.New("attempt to delete score that does not exist")
	}
	_, _, err = self.scoresDB.InsertWith(score, _id)
	return err
}
