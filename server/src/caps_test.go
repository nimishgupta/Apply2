package caps

import (
  "testing"
  "crypto/rand"
  "util"
  "http"
  "http/httptest"
  "strconv"
  "io"
  "json"
)

func createServer(t *testing.T) CapServer {
  key := make([]byte, 16)
  n, err := rand.Read(key)
  if err != nil {
    t.Fatalf("keygen failed %v", err)
  }
  if n != 16 {
    t.Fatalf("read %v bytes, expected 16", n)
  }

  cs := NewCryptCapServer("/", key, key)
  if cs == nil {
    t.Fatalf("NewCryptCapServer failed")
  }
  return cs
}

func makeEchoValueHandler(expected string, t *testing.T) HandlerFunc {
  return func (value string, w http.ResponseWriter, r *http.Request) {
    if expected != value {
      t.Fatalf("expected %v, got %v in handler", expected, value)
    }
    buf := util.StringToBytes(value)
    w.Header().Add("Content-Length", strconv.Itoa(len(buf)))
    w.Write(buf)
  }
}

func constHandler(value string, w http.ResponseWriter, r *http.Request) {
  buf := util.StringToBytes("constHandler")
  w.Header().Add("Content-Length", strconv.Itoa(len(buf)))
  w.Write(buf)
}

func jsonHandler(value string, w http.ResponseWriter, r *http.Request) {
  resp := make(map[string]interface {}, 1)
  resp["v"] = value
  util.JSONResponse(w, resp)
}

func TestCreateServer(t *testing.T) {
  createServer(t)

}

func TestHandler(t *testing.T) {
  cs := createServer(t)

  cs.HandleFunc("h1", makeEchoValueHandler("mycap", t))
  
  // TODO: figure out how to test,
  // err = cs.HandleFunc("h1", makeEchoValueHandler("mycap", t))

  cs.HandleFunc("h2", constHandler)
  cs.HandleFunc("h3", jsonHandler)

  server := httptest.NewServer(cs.CapHandler())
  defer server.Close()
  client := &http.Client{nil, nil}

  _, err := client.Get(server.URL + "/h1")
  if err != nil {
    t.Fatalf("request failed %v", err)
  }

  cap1 := cs.Grant("h1", "mycap")
  resp, err := client.Get(server.URL + cap1)
  if err != nil {
    t.Fatalf("request failed %v", err)
  }
  if resp.StatusCode != 200 {
    t.Fatalf("expected 200, got %v", resp.StatusCode)
  }
  bytes := make([]byte, resp.ContentLength)
  io.ReadFull(resp.Body, bytes)
  if string(bytes) != "mycap" {
    t.Fatalf("cap produced %v", string(bytes))
  }

  cap2 := cs.Grant("h2", "foo")
  resp, _ = client.Get(server.URL + cap2)
  bytes = make([]byte, resp.ContentLength)
  io.ReadFull(resp.Body, bytes)
  if string(bytes) != "constHandler" {
    t.Fatalf("expected constHandler; response was %v", resp)
  }

  cap3 := cs.Grant("h3", "miata")
  resp, _ = client.Get(server.URL + cap3)
  bytes = make([]byte, resp.ContentLength)
  io.ReadFull(resp.Body, bytes)
  jsonRes := make(map[string](interface { }))
  err = json.Unmarshal(bytes, &jsonRes)
  if err != nil {
    t.Fatalf("json.Unmarshal(%v, _) = %v", bytes, err)
  }
  v, _ := jsonRes["v"]
  if v != "miata" {
    t.Fatalf("expected miata, got %v", v)
  }

}
