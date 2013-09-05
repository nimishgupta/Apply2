package server

import (
	"caps"
	"fmt"
	"io"
	"log"
	"model"
	"net"
	"net/http"
	"net/http/fcgi"
	"net/smtp"
	"net/url"
	"os"
	"path/filepath"
	"time"
	"util"
)

const dataKey = "data"
const materialKey = "material"
const fetchCommentsKey = "fetchComments"
const postCommentKey = "postComment"
const setHighlightKey = "setHighlight"
const delHighlightKey = "delHighlight"
const setScoreKey = "setScore"
const changePasswordKey = "changePassword"
const resetPasswordKey = "resetPassword"

var capServer caps.CapServer
var dept *model.Dept
var mailAuth smtp.Auth

type FetchCommentsEnv struct {
	ReviewerName string           `json:"n"`
	ReviewerId   model.ReviewerId `json:"i"`
	AppId        string           `json:"a"`
}

type ResetPasswordEnv struct {
	ReviewerId model.ReviewerId `json:"n"`
	Expires    int              `json:"d"`
}

func resetPasswordHandler(key string, w http.ResponseWriter, r *http.Request) {
	var arg ResetPasswordEnv
	err := util.StringToJSON(key, &arg)
	if err != nil {
		log.Printf("FATAL ERROR decoding closure %v in resetPasswordHandler", key)
		w.WriteHeader(500)
		r.Close = true
		return
	}
	if r.Method != "POST" {
		log.Printf("%v SECURITY ERROR %v trying to %v to %v", r.RemoteAddr,
			arg.ReviewerId, r.Method, r.URL)
		w.WriteHeader(http.StatusBadRequest)
		r.Close = true
		return
	}
	now := time.Now().Unix()
	if int(now) > arg.Expires {
		log.Printf("%v ERROR using expired password reset cap. arg=%v",
			r.RemoteAddr, arg)
		w.WriteHeader(http.StatusBadRequest)
		r.Close = true
		return
	}
	var pass struct {
		NewPassword string `json:"password"`
	}
	err = util.JSONBody(r, &pass)
	if err != nil {
		log.Printf("%v ERROR decoding request: %v\n", r.RemoteAddr, r)
		w.WriteHeader(500)
		r.Close = true
		return
	}
	err = dept.ChangePassword(arg.ReviewerId, pass.NewPassword)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		w.Write(util.StringToBytes(fmt.Sprintf("%v", err)))
		r.Close = true
		return
	}
	w.WriteHeader(200)
	w.Write(util.StringToBytes("Password reset"))
	return
}

func dataHandler(key string, w http.ResponseWriter, r *http.Request) {
	apps, err := dept.Applications(key)
	if err != nil {
		log.Printf("reading apps: %v", err)
		return
	}

	err = util.JSONResponse(w, apps)
	if err != nil {
		log.Printf("writing response: %v", err)
		return
	}
}

func materialHandler(key string, w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		panic("expected GET")
	}

	cookie, err := r.Cookie("materialsCap")
	if err != nil || cookie.Value != r.URL.Path {
		log.Printf("%v SECURITY ERROR %v trying to use materials capability %v",
			r.RemoteAddr, key, r.URL.Path)
		w.WriteHeader(http.StatusBadRequest)
		r.Close = true
		return
	}

	untrustedDocName, err := url.QueryUnescape(r.URL.RawQuery)
	if err != nil {
		panic(err)
	}

	log.Printf("%v downloaded %v", key, untrustedDocName)

	// TODO(arjun): this is no longer a file path, but a URL fragment, I think
	docDir, docName := filepath.Split(untrustedDocName)
	if docDir != "" {
		log.Printf("%v SECURITY ERROR %v trying to read document %v", r.RemoteAddr,
			key, untrustedDocName)
		w.WriteHeader(http.StatusBadRequest)
		r.Close = true
		return
	}

	log.Printf("%v %v downloaded %v", r.RemoteAddr, key, docName)
	w.Header().Add("Content-Disposition",
		fmt.Sprintf("inline; filename = %q", docName))

	err = dept.DownloadFile(docName, w)
	if err != nil {
		log.Printf("dept.DownloadFile(%v, _) error: %v", docName, err)
		w.WriteHeader(http.StatusBadRequest)
		r.Close = true
	}
}

func postCommentHandler(v string, w http.ResponseWriter, r *http.Request) {
	// TODO: use and enforce PUT
	var arg FetchCommentsEnv
	err := util.StringToJSON(v, &arg)
	if err != nil {
		panic(err)
	}

	buf := make([]byte, r.ContentLength)
	_, err = io.ReadFull(r.Body, buf)
	if err != nil {
		panic(err)
	}

	now := time.Now().Unix()

	err = dept.NewComment(&model.Comment{arg.AppId, arg.ReviewerId,
		arg.ReviewerName, float64(now), string(buf)})
	if err != nil {
		panic(err)
	}
	w.WriteHeader(200)
}

func fetchCommentsHandler(key string, w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		panic("expected GET")
	}

	query, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		panic(err)
	}
	appId := query.Get("appId")

	comments, err := dept.LoadComments(appId)
	if err != nil {
		panic(err)
	}

	rev, err := dept.GetReviewerById(model.ReviewerId(key))
	if err != nil {
		panic(err)
	}

	env, err := util.JSONToString(&FetchCommentsEnv{rev.Name, rev.Id, appId})
	if err != nil {
		panic(err)
	}

	highlightedBy, err := dept.HighlightsByApp(appId)
	if err != nil {
		panic(err)
	}

	_ = util.JSONResponse(w, map[string]interface{}{
		"appId":          appId,
		"comments":       comments,
		"post":           capServer.Grant(postCommentKey, env),
		"setScoreCap":    capServer.Grant(setScoreKey, env),
		"highlightCap":   capServer.Grant(setHighlightKey, env),
		"unhighlightCap": capServer.Grant(delHighlightKey, env),
		"highlightedBy":  highlightedBy,
	})

	log.Printf("%v fetched comments for %v", key, appId)
}

func setHighlightHandler(v string, w http.ResponseWriter, r *http.Request) {
	// TODO: use and enforce PUT
	var arg FetchCommentsEnv
	err := util.StringToJSON(v, &arg)
	if err != nil {
		panic(err)
	}
	var req struct {
		ReaderId string `json:"readerId"`
	}
	err = util.ReaderToJSON(r.Body, int(r.ContentLength), &req)
	if err != nil {
		panic(err)
	}
	now := time.Now().Unix()
	hl := &model.Highlight{
		arg.AppId,
		model.ReviewerId(req.ReaderId),
		arg.ReviewerId,
		arg.ReviewerName,
		float64(now),
	}
	err = dept.SetHighlight(hl)
	if err != nil {
		panic(err)
	}
	w.WriteHeader(200)
}

func delHighlightHandler(key string, w http.ResponseWriter, r *http.Request) {
	var arg FetchCommentsEnv
	err := util.StringToJSON(key, &arg)
	if err != nil {
		log.Printf("FATAL ERROR decoding closure %v in setScoreHandler", key)
		w.WriteHeader(500)
		return
	}
	if r.Method != "POST" {
		log.Printf("%v SECURITY ERROR %v trying to %v to %v", r.RemoteAddr,
			arg.ReviewerId, r.Method, r.URL)
		w.WriteHeader(http.StatusBadRequest)
		r.Close = true
		return
	}
	err = dept.DelHighlight(arg.AppId, string(arg.ReviewerId))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		r.Close = true
		log.Printf("%v ERROR DelHighlight(%v, %v): %v", r.RemoteAddr, arg.AppId,
			arg.ReviewerId, err)
		return
	}
	w.WriteHeader(200)
}

// Sends an email to the user with a capability to reset the password.
func sendPasswordResetEmailHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		w.WriteHeader(500)
		r.Close = true
		return
	}
	var cred struct {
		Username string `json:"username"`
	}
	err := util.JSONBody(r, &cred)
	if err != nil {
		log.Printf("%v ERROR decoding request: %v\n", r.RemoteAddr, r)
		w.WriteHeader(500)
		r.Close = true
		return
	}
	// Do not report "username does not exist" to the client.
	w.WriteHeader(200)
	util.JSONResponse(w, map[string]interface{}{"msg": "Check your email"})
	if !dept.ReviewerExists(model.ReviewerId(cred.Username)) {
		log.Printf("%v ERROR user %v does not exist", r.RemoteAddr, cred.Username)
		return
	}
	now := time.Now().Unix()
	env, _ := util.JSONToString(&ResetPasswordEnv{model.ReviewerId(cred.Username),
		int(now) + 1000})
	resetCap := capServer.Grant(resetPasswordKey, env)
	arg, _ := util.JSONToString(map[string]interface{}{"resetCap": resetCap})
	arg = url.QueryEscape(arg)
	arg = "http://apply.cs.umass.edu/#" + arg
	emailBody :=
		fmt.Sprintf("Subject: Password Reset\n\nTo reset your password, please visit the following link:\n\n%v", arg)
	err = smtp.SendMail("mail.cs.umass.edu:25", nil,
		"devnull@cs.umass.edu",
		[]string{cred.Username}, util.StringToBytes(emailBody))
	if err != nil {
		log.Printf("ERROR sending mail for user %v, err=%v\n", cred.Username, err)
	}
}

// Authenticates a login request and returns capabilities to initial data.
func loginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		log.Printf("Invalid request: %v", r)
		return
	}
	var cred struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	err := util.JSONBody(r, &cred)
	if err != nil {
		panic(fmt.Sprintf("invalid request: %v", err))
	}

	log.Printf("%v attempt to login", cred.Username)
	rev, err := dept.AuthReviewer(model.ReviewerId(cred.Username), cred.Password)
	if err != nil {
		util.JSONResponse(w,
			map[string]interface{}{"msg": "invalid username or password"})
		return
	}

	reviewers, err := dept.GetReviewerIdMap()
	if err != nil {
		panic(err)
	}

	matsCap := capServer.Grant(materialKey, cred.Username)

	// Checked by materialHandler. Capability security is sufficient, but this
	// helps if URLs leak.
	w.Header().Add("Set-Cookie", fmt.Sprintf("materialsCap=%v", matsCap))

	err = util.JSONResponse(w, map[string]interface{}{
		"revId":             cred.Username,
		"friendlyName":      rev.Name,
		"appsCap":           capServer.Grant(dataKey, cred.Username),
		"materialsCap":      matsCap,
		"fetchCommentsCap":  capServer.Grant(fetchCommentsKey, cred.Username),
		"changePasswordCap": capServer.Grant(changePasswordKey, cred.Username),
		"reviewers":         reviewers,
	})
	if err != nil {
		panic("serializing response")
	}
	return
}

func setScoreHandler(key string, w http.ResponseWriter, r *http.Request) {
	var arg FetchCommentsEnv
	err := util.StringToJSON(key, &arg)
	if err != nil {
		log.Printf("FATAL ERROR decoding closure %v in setScoreHandler", key)
		w.WriteHeader(500)
		return
	}
	if r.Method != "POST" {
		log.Printf("%v SECURITY ERROR %v trying to %v to %v", r.RemoteAddr,
			arg.ReviewerId, r.Method, r.URL)
		w.WriteHeader(http.StatusBadRequest)
		r.Close = true
		return
	}
	var req struct {
		Label string `json:"label"`
		Score *int   `json:"score"`
	}
	err = util.ReaderToJSON(r.Body, int(r.ContentLength), &req)
	if err != nil && req.Label != "score" {
		w.WriteHeader(http.StatusBadRequest)
		r.Close = true
		return
	}
	score := &model.Score{arg.AppId, arg.ReviewerId, req.Label, req.Score}
	err = dept.SetScore(score)
	if err != nil {
		w.WriteHeader(500)
		r.Close = true
		log.Printf("%v ERROR SetScore(%v)", r.RemoteAddr, score)
		return
	}
	w.WriteHeader(200)
	return
}

func changePasswordHandler(key string, w http.ResponseWriter, r *http.Request) {
	user := key
	if r.Method != "POST" {
		log.Printf("%v SECURITY ERROR %v trying to %v to %v", r.RemoteAddr,
			user, r.Method, r.URL)
		w.WriteHeader(http.StatusBadRequest)
		r.Close = true
		return
	}
	var req struct {
		OldPassword string `json:"oldPassword"`
		NewPassword string `json:"newPassword"`
	}
	err := util.ReaderToJSON(r.Body, int(r.ContentLength), &req)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		r.Close = true
		return
	}
	_, err = dept.AuthReviewer(model.ReviewerId(user), req.OldPassword)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		w.Write(util.StringToBytes(fmt.Sprintf("%v", err)))
		r.Close = true
		return
	}
	err = dept.ChangePassword(model.ReviewerId(user), req.NewPassword)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		w.Write(util.StringToBytes(fmt.Sprintf("%v", err)))
		r.Close = true
		return
	}
	w.WriteHeader(200)
	w.Write(util.StringToBytes("Password changed"))
	return
}

func initSMTP(r io.Reader) smtp.Auth {
	var user, pass, host string
	_, err := fmt.Fscanf(r, "User: %s\nPass: %s\nHost: %s\n", &user, &pass, &host)
	if err != nil {
		panic(err)
	}
	return smtp.PlainAuth("", user, pass, host)
}

func Serve(key []byte, isTesting bool) {

	_dept, err := model.LoadDept("localhost", "5984")
	if err != nil {
		panic(err)
	}
	dept = _dept

	capServer = caps.NewCryptCapServer("/caps/", key, key)
	capServer.HandleFunc(dataKey, dataHandler)
	capServer.HandleFunc(materialKey, materialHandler)
	capServer.HandleFunc(fetchCommentsKey, fetchCommentsHandler)
	capServer.HandleFunc(postCommentKey, postCommentHandler)
	capServer.HandleFunc(setHighlightKey, setHighlightHandler)
	capServer.HandleFunc(delHighlightKey, delHighlightHandler)
	capServer.HandleFunc(setScoreKey, setScoreHandler)
	capServer.HandleFunc(changePasswordKey, changePasswordHandler)
	capServer.HandleFunc(resetPasswordKey, resetPasswordHandler)

	http.HandleFunc("/caps/", util.ProtectHandler(capServer.CapHandler()))
	http.HandleFunc("/login", util.ProtectHandler(loginHandler))
	http.HandleFunc("/reset", util.ProtectHandler(sendPasswordResetEmailHandler))

	log.Printf("Starting server ...")
	if isTesting {
		// Simple sanity check for the user: look for the www/ directory.
		fi, err := os.Lstat("www")
		if err != nil {
			fmt.Printf("Could not find the ./www directory.\n")
			return
		}
		if !fi.IsDir() {
			fmt.Printf("Expected ./www to be a directory.\n")
			return
		}

		http.Handle("/", http.FileServer(http.Dir("www")))
		http.ListenAndServe(":8080", nil)
	} else {
		l, err := net.Listen("tcp", "127.0.0.1:9111")
		if err != nil {
			panic(err)
		}
		err = fcgi.Serve(l, http.DefaultServeMux)
		if err != nil {
			panic(err)
		}
	}
}
