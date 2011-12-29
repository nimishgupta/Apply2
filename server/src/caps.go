/** Implements cap servers */
package caps

import (
  "os"
  "crypto/aes"
  "crypto/cipher"
  "encoding/base64"
  "fmt"
  "http"
  "log"
  "json"
  "bytes"
)

// A CapServer grants capabilities to its handlers as URLs.
type CapServer interface {
  Grant(path string, value string) string
  // HandleFunc panics if there already is a handler associated with the given key.
  HandleFunc(key string, handler HandlerFunc)
  CapHandler() http.HandlerFunc
}

// A HandlerFunc is invoked when a granted capability is applied with the same
// value argument that was supplied to the CapServer.Grant.
//
// The other arguments are used exactly as in http.HandlerFunc.
type HandlerFunc func(value string, w http.ResponseWriter, r *http.Request)

type cryptCapServer struct {
  ciph cipher.Block
  iv []byte
  handlers map[string]HandlerFunc
  basePath string
}

// CapData is the 
type capData struct {
  Key string `json:"k"`
  Value string `json:"v"`
}


func NewCryptCapServer(basePath string, key []byte, iv []byte) CapServer {
  ciph, err := aes.NewCipher(key)
  if (err != nil) {
    panic(err)
  }

  return &cryptCapServer{ ciph, iv, make(map[string]HandlerFunc, 10), basePath }
}

func (self *cryptCapServer) HandleFunc(key string, handler HandlerFunc) {
  _, exists := self.handlers[key]
  if exists {
    panic(os.NewError(fmt.Sprintf("handler %v already defined", key)))
  }
  self.handlers[key] = handler
}

func (self *cryptCapServer) Grant(key string, value string) string {
  kvStruct := &capData{key, value}
  buf, err := json.Marshal(kvStruct)
  if (err != nil) {
    panic(err)
  }
  padLen := self.ciph.BlockSize() - len(buf) % self.ciph.BlockSize()
  pad := bytes.Repeat([]byte{32 /*space*/}, padLen)
  buf = append(buf, pad ...)
  cipher.NewCBCEncrypter(self.ciph, self.iv).CryptBlocks(buf, buf)
  url := self.basePath + base64.URLEncoding.EncodeToString(buf)
  log.Printf("GRANT key=%v val=%v url=%v", key, value, url)
  return url
}

func (self *cryptCapServer) CapHandler() http.HandlerFunc {
  return func(w http.ResponseWriter, r *http.Request) {
    defer func() {
      log.Printf("%v END url=%v method=%v", r.RemoteAddr, r.RawURL, r.Method)
    }()
    
    log.Printf("%v BEGIN url=%v method=%v", r.RemoteAddr, r.RawURL, r.Method)

    base64Text := r.URL.Path[len(self.basePath):]
    buf, err := base64.URLEncoding.DecodeString(base64Text)
    
    if err != nil {
      log.Printf("%v ERROR base64-decoding err=%v", r.RemoteAddr, err)
      w.WriteHeader(http.StatusBadRequest)
      r.Close = true
      return
    }

    cipher.NewCBCDecrypter(self.ciph, self.iv).CryptBlocks(buf, buf)
    var kv capData
    err = json.Unmarshal(buf, &kv)

    if err != nil {
      log.Printf("%v ERROR unmarshaling err=%v", r.RemoteAddr, err)
      w.WriteHeader(http.StatusBadRequest)
      r.Close = true
      return      
    }

    handler, found := self.handlers[kv.Key]

    if !found {
      log.Printf("%v ERROR no handler key=%v val=%v", r.RemoteAddr, kv.Key, kv.Value)
      w.WriteHeader(http.StatusBadRequest)
      r.Close = true
      return
    }

    log.Printf("%v INVOKE key=%v value=%v", r.RemoteAddr, kv.Key, kv.Value)
    handler(kv.Value, w, r)
  }
}
