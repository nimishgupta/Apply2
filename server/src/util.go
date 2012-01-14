package util

import (
  "crypto/sha256"
  "strings"
  "io"
  "os"
  "http"
  "json"
  "strconv"
  "fmt"
  "log"
  "runtime/debug"
)

type JSObj map[string](interface { })
type JSArray []interface { }

func StringToBytes(str string) []byte {
  reader := strings.NewReader(str)
  bytes := make([]byte, reader.Len()) // != len(plain) (Unicode)
  n, err := io.ReadFull(reader, bytes)
  if err != nil {
    panic(err)
  }
  if n != len(bytes) {
    panic("StringtoBytes")
  }
  return bytes
}

func JSONToString(jsonVal interface { }) (string, os.Error) {
  buf, err := json.Marshal(jsonVal)
  if err != nil {
    return "", err
  }
  return string(buf), err
}

func ReaderToJSON(reader io.Reader, length int, out interface { }) os.Error {
  buf := make([]byte, length)
  n, err := io.ReadFull(reader, buf)
  if err != nil {
    return err
  }
  if n != length {
    return os.NewError(fmt.Sprintf("ReaderToJSON: expected %v bytes, received %v",
                                   length, n))
  }
  return json.Unmarshal(buf, out)
}

func StringToJSON(str string, out interface { }) os.Error {
  reader := strings.NewReader(str)
  m := reader.Len()
  buf := make([]byte, m)
  n, err := io.ReadFull(reader, buf)
  if err != nil {
    return err
  }
  if n != m {
    return err
  }
  return json.Unmarshal(buf, out)
}

func HashString(str string) []byte {
  hash := sha256.New()
  bytes := StringToBytes(str)
  n, err := hash.Write(bytes)
  if err != nil {
    panic(err)
  }
  if n != len(bytes) {
    panic("HashString")
  }
  return hash.Sum()
}

func SetHeaders(w http.ResponseWriter) {
  w.Header().Add("Content-type", "text/plain;charset=UTF-8")
}

/** Tries to decode the body as JSON and unmarshal it to the body argument.
 */
func JSONBody(req *http.Request, body interface { }) os.Error {
  buf := make([]byte, req.ContentLength)
  _, err := io.ReadFull(req.Body, buf)
  if err != nil {
    return err
  }

  err = json.Unmarshal(buf, body)
  return err
}

func JSONResponse(w http.ResponseWriter, resp interface { }) os.Error {
  bytes, err := json.Marshal(resp)
  if (err != nil) {
    return err
  }
  
  w.Header().Add("Content-type", "text/plain;charset=UTF-8")

  // Content-Length must be set before the call to w.Write.
  w.Header().Add("Content-Length", strconv.Itoa(len(bytes)))

  _, err = w.Write(bytes)
  if (err != nil) {
    return err
  }

  return nil
}

func ProtectHandler(handler http.HandlerFunc) http.HandlerFunc {
  return func(w http.ResponseWriter, r *http.Request) {
    defer func() {
      err := recover()
      if err != nil {
        log.Printf("%v PANIC url=%v, error=%v, stack:\n%v", r.RemoteAddr, err, 
                   r.RawURL, string(debug.Stack()))
      }
    }()
    handler(w, r)
  }
}
