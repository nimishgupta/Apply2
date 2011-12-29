package model

import (
  "testing"
  "io/ioutil"
  "json"
  "os"
  "fmt"
)

import db "couch-go.googlecode.com/hg"

const host = "127.0.0.1"
const port = "5984"

func testDept(name string, t *testing.T) *Dept {
  for _, suffix := range(dbSuffixes) {
    d := db.Database{host, port, name + suffix}
    if d.Exists() {
      d.DeleteDatabase()
    }
  }
  
  dept, err := NewDept(host, port, name)
  if err != nil {
    t.Fatalf("creating a new department failed: %v", err)
  }
  return dept
}

func TestCreateDeleteDept(t *testing.T) {
  dept := testDept("unittestdb",t) 
  dept.Delete()
}

func TestLoadDept(t *testing.T) {
  dept := testDept("testloaddept", t)
  defer dept.Delete()

  _, err2 := LoadDept(host, port, "testloaddept")
  if err2 != nil { t.Fatalf("LoadDept failed: %q", err2) }
}

func TestLoadApplications(t *testing.T) {
  var err os.Error

  var src []byte
  src, err = ioutil.ReadFile("data.json")
  if (err != nil) { t.Fatalf("reading file failed: %v", err) }

  var applications []Application
  err = json.Unmarshal(src, &applications)
  if (err != nil) { t.Fatalf("parsing JSON failed: %v", err) }

  var dept *Dept


  dept, err = NewDept(host, port, "unittestdb")
  if (err != nil) { t.Fatalf("NewDept", err) }
  defer dept.Delete()


  for _, app := range applications {
    err = dept.NewApplication(app)
    if (err != nil) { t.Fatalf("NewApplication", err) }
  }

  var fetched []map[string]interface{}
  fetched, err = dept.Applications("0")
  if (err != nil) { t.Fatalf("Applications", err) }

  if (len(fetched) != len(applications)) {
    t.Fatalf("stored %v, but fetched %v", len(applications), len(fetched))
  }
  
}

func TestNewReviewer(t *testing.T) {
  dept := testDept("testnewreviewer", t)
  defer dept.Delete()

  r1, err := dept.NewReviewer("potter", "Harry Potter", "redbull64")
  if err != nil {
    t.Fatalf("NewReviewer (1)", err)
  }

  // No uniqueness on names
  r2, err := dept.NewReviewer("potter2", "Harry Potter", "redbull65")
  if err != nil {
    t.Fatalf("NewReviewer (2)", err)
  }

  if r1.Id == r2.Id {
    t.Fatalf("Expected different ids")
  }
}

func TestGetReviewers(t *testing.T) {
  d := testDept("testgetreviewers", t)
  defer d.Delete()
  r1, _ := d.NewReviewer("a", "Alex", "redbull64")
  r2, _ := d.NewReviewer("b", "Bob", "redbull64")
  r3, _ := d.NewReviewer("c", "Cow", "redbull64")
  m, err := d.GetReviewerIdMap()
  if err != nil {
    t.Fatalf("GetReviewerIdMap failed: %v", err)
  }
  if m[string(r1.Id)] != r1.Name || m[string(r2.Id)] != r2.Name || 
     m[string(r3.Id)] != r3.Name {
    t.Fatalf("bad map: %v", m)
  }
}

func TestAuthReviewer(t *testing.T) {
  dept := testDept("testauthreviewer", t)
  rev1, err := dept.NewReviewer("goldilocks@wolf.edu", "Eaten", "redbull65")
  if err != nil {
    t.Fatalf("NewReviewer")
  }

  rev2, err := dept.AuthReviewer("goldilocks@wolf.edu", "redbull65")
  if err != nil {
    t.Fatalf("AuthReviewer")
  }

  if rev1.Id != rev2.Id {
    t.Fatalf("got different users")
  }
  dept.Delete()
}

func TestComments1(t *testing.T) {

  dept := testDept("testcomments", t)
  defer dept.Delete()

  rev, _ := dept.NewReviewer("santa@pole.gov", "Claus", "redbull66")

  app := Application{ "99", nil, nil, nil, nil, nil, nil, nil,
               nil, nil, nil, nil }

  _ = dept.NewApplication(app)

  err := dept.NewComment(&Comment{app.EmbarkId, rev.Id, rev.Name, 0, "epic fail"})
  if err != nil {
    t.Fatalf("NewComment: %v", err)
  }

  comments, err := dept.LoadComments(app.EmbarkId)
  if err != nil {
    t.Fatalf("LoadComments %v", err)
  }
  if len(comments) != 1 {
    t.Fatalf("expected 1 comment, got %v", len(comments))
  }
  if comments[0].Text != "epic fail" {
    t.Fatalf("text = %v", comments[0].Text)
  }

}

func mkApp(id string) Application  {
  return Application{ id, nil, nil, nil, nil, nil, nil, nil,
               nil, nil, nil, nil }
}


func TestHighlighting(t *testing.T) {
  d := testDept("testhighlighting", t)

  rev1, _ := d.NewReviewer("writer@revs.org", "Writer", "redbull64")
  rev2, _ := d.NewReviewer("reader@revs.org", "Reader", "redbull65")
  _ = d.NewApplication(mkApp("1"))
  _ = d.NewApplication(mkApp("2"))
  _ = d.NewApplication(mkApp("3"))
  _ = d.NewApplication(mkApp("4"))

  lst, err := d.GetHighlights(rev2.Id)
  if err != nil {
    t.Fatalf("1st GetHighlights failed: %v", err)
  }
  if len(lst) != 0 {
    t.Fatalf("expected 0, got %v", len(lst))
  }

  hl := &Highlight{"1", rev2.Id, rev1.Id, "Writer", 900}
  err = d.SetHighlight(hl)
  if err != nil {
    t.Fatalf("SetHighlight error: %v", err)
  }

  lst, err = d.GetHighlights(rev2.Id)
  if err != nil {
    t.Fatalf("2nd GetHighlights error: %v", err)
  }
  if len(lst) != 1 {
    t.Fatalf("expected 1 highlight, got %v", lst)
  }
  if lst[0] != "1" {
    t.Fatalf("expected highlight on appId=1, got %v", lst[0])
  }

  lst, err = d.HighlightsByApp("1")
  if err != nil {
    t.Fatalf("HighlightsByApp error: %v", err)
  }
  if len(lst) != 1 {
    t.Fatalf("expected 1 reader, got %v", lst)
  }
  if lst[0] != string(rev2.Id) {
    t.Fatalf("expected highlight by rev2, got %v", lst[0])
  }

  err = d.DelHighlight(hl)
  if err != nil {
    t.Fatalf("DelHighlight error: %v", err)
  }
}

func TestLoadComments(t *testing.T) {
  dept := testDept("testloadcomments", t)
  defer dept.Delete()
  rev, err := dept.NewReviewer("santa@pole.gov", "Claus", "redbull66")
  if err != nil {
    t.Fatalf("NewReviewer")
  }
  
  var src []byte
  src, err = ioutil.ReadFile("data.json")
  if (err != nil) { t.Fatalf("reading file failed: %v", err) }

  var applications []Application
  err = json.Unmarshal(src, &applications)
  if (err != nil) { t.Fatalf("parsing JSON failed: %v", err) }
  
  for _, app := range applications {
    err = dept.NewApplication(app)
    if (err != nil) { t.Fatalf("NewApplication", err) }
  }

  for j, app := range applications {
    for i := 0; i <  100; i = i + 1 {
      err = dept.NewComment(&Comment{app.EmbarkId, rev.Id, rev.Name, 0,
                            fmt.Sprintf("Comment %v", i)})
      if err != nil {
        t.Errorf("Error writing comment %v", (i + 1) * (j + 1));
      }
    }
    t.Logf("Wrote comments for id=%v", app.EmbarkId)
    if (j > 10) {
      break
    }
  }

  for j, app := range applications {
    if j > 10 {
      break
    }
    comments, err := dept.LoadComments(app.EmbarkId);
    if err != nil {
      t.Errorf("Error reading comment: %v", err);
    }
    if len(comments) != 100 {
      t.Errorf("Expected 100 comments, got %v for id=%v", len(comments),
      app.EmbarkId);
    }
  }
}

func TestScores(t *testing.T) {
  dept := testDept("testscores", t)
  defer dept.Delete()
  dept.NewReviewer("myrev", "Claus", "redbull66")
  dept.NewApplication(Application{ "myappid", nil, nil, nil, nil,
    nil, nil, nil, nil, nil, nil, nil })
  scr := 100
  err := dept.SetScore(&Score{"myappid","myrev","total",&scr})
  if err != nil {
    t.Fatalf("first SetScore failed: %v", err)
  }
  apps, _ := dept.Applications("0")
  if len(apps) != 1 {
    t.Fatalf("expected 1 application, got %v: %v", len(apps), apps)
  }
  scoreMap, found := apps[0]["score_total"].(map[string]float64)
  if !found {
    t.Fatalf("score map not found, record is %v", apps[0])
  }
  if scoreMap["myrev"] != 100 {
    t.Fatalf("expected score to be 100, got score map %v", scoreMap)
  }

  scr = 50
  err = dept.SetScore(&Score{"myappid","myrev","total",&scr})
  if err != nil {
    t.Fatalf("second SetScore failed: %v", err)
  }
  apps, _ = dept.Applications("0")
  if apps[0]["score_total"].(map[string]float64)["myrev"] != 50 {
    t.Fatalf("expected score to be 50, got apps %v", apps)
  }

  err = dept.SetScore(&Score{"myappid","myrev","total",nil})
  if err != nil {
    t.Fatalf("third SetScore failed: %v", err)
  }
  
  apps, _ = dept.Applications("0")
  bad, found := apps[0]["score_total"]
  if found {
    t.Fatalf("expected score to be deleted, got %v", bad)
  }
}
