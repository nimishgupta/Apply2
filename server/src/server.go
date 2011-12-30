package server

import (
  "net"
  "http/fcgi"
  "http"
  "fmt"
  "caps"
  "log"
  "model"
  "io/ioutil"
  "util"
  "url"
  "io"
  "os"
  "path/filepath"
)

const dataKey = "data"
const materialKey = "material"
const fetchCommentsKey = "fetchComments"
const postCommentKey = "postComment"
const setHighlightKey = "setHighlight"
const delHighlightKey = "delHighlight"
const setScoreKey = "setScore"

var capServer caps.CapServer
var dept *model.Dept
var deptDocPath *string

type FetchCommentsEnv struct {
  ReviewerName string `json:"n"`
  ReviewerId model.ReviewerId `json:"i"`
  AppId string `json:"a"`
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

  untrustedDocName, err := url.QueryUnescape(r.URL.RawQuery)
  if err != nil {
    panic(err)
  }

  log.Printf("%v downloaded %v", key, untrustedDocName)

  docDir, docName := filepath.Split(untrustedDocName)
  if docDir != "" {
    log.Printf("%v SECURITY ERROR %v trying to read document %v", r.RemoteAddr,
      key, untrustedDocName)
    w.WriteHeader(http.StatusBadRequest)
    r.Close = true
    return
  }

  log.Printf("%v %v downloaded %v", r.RemoteAddr, key, docName)
  w.Header().Add("Content-Disposition", "inline; filename = " + docName)

  http.ServeFile(w, r, *deptDocPath + docName)
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
  
  now, _, _ := os.Time()

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
  if err != nil { panic(err) }
  
  _ = util.JSONResponse(w, map[string]interface{} {
    "appId": appId,
    "comments": comments,
    "post": capServer.Grant(postCommentKey, env),
    "setScoreCap": capServer.Grant(setScoreKey, env),
    "highlightCap": capServer.Grant(setHighlightKey, env),
    "unhighlightCap": capServer.Grant(delHighlightKey, env),
    "highlightedBy": highlightedBy,
  })

  log.Printf("%v fetched comments for %v", key, appId);
}

func setHighlightHandler(v string, w http.ResponseWriter, r *http.Request) {
  // TODO: use and enforce PUT
  var arg FetchCommentsEnv
  err := util.StringToJSON(v, &arg)
  if err != nil {
    panic(err)
  }
  var req struct { ReaderId string `json:"readerId"` }
  err = util.ReaderToJSON(r.Body, int(r.ContentLength), &req)
  if err != nil {
    panic(err)
  }
  now, _, _ := os.Time()
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
  if (err != nil) {
    panic(fmt.Sprintf("invalid request: %v", err))
  }
 
  log.Printf("%v attempt to login", cred.Username)
  rev, err := dept.AuthReviewer(model.ReviewerId(cred.Username), cred.Password)
  if (err != nil) {
    panic("invalid password")
  }

  reviewers, err := dept.GetReviewerIdMap()
  if err != nil {
    panic(err)
  }

  err = util.JSONResponse(w, map[string]interface{} {
    "revId": cred.Username,
    "friendlyName": rev.Name, 
    "appsCap": capServer.Grant(dataKey, cred.Username),
    "materialsCap": capServer.Grant(materialKey, cred.Username),
    "fetchCommentsCap": capServer.Grant(fetchCommentsKey, cred.Username),
    "reviewers": reviewers,
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
    Score *int `json:"score"`
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

func Serve(deptPath string, deptName string) {
  keyFile := deptPath + "/private.key"
  fi, err := os.Lstat(keyFile)
  if err != nil {
    panic(err)
  }
  if !fi.IsRegular() {
    panic(err)
  }

  p := deptPath + "/docs/"
  deptDocPath = &p

  _dept, err := model.LoadDept("localhost", "5984", deptName)
  if (err != nil) {
    panic(err)
  }
  dept = _dept

  key, err := ioutil.ReadFile(keyFile)
  if err != nil {
    panic(err)
  }
  capServer = caps.NewCryptCapServer("/caps/", key, key)
  capServer.HandleFunc(dataKey, dataHandler)
  capServer.HandleFunc(materialKey, materialHandler)
  capServer.HandleFunc(fetchCommentsKey, fetchCommentsHandler)
  capServer.HandleFunc(postCommentKey, postCommentHandler)
  capServer.HandleFunc(setHighlightKey, setHighlightHandler)
  capServer.HandleFunc(delHighlightKey, delHighlightHandler)
  capServer.HandleFunc(setScoreKey, setScoreHandler)

  http.HandleFunc("/caps/", util.ProtectHandler(capServer.CapHandler()))
  http.HandleFunc("/login", util.ProtectHandler(loginHandler))

  log.Printf("Starting server ...")
//  http.ListenAndServe(":8080", nil)
  l, err := net.Listen("tcp", "127.0.0.1:9111")
  if err != nil {
    panic(err)
  }
  err = fcgi.Serve(l, http.DefaultServeMux)
  if err != nil {
    panic(err)
  }
}
