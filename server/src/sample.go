package sample

import (
  "model"
  "os"
  "fmt"
  "io"
  "crypto/rand"
  "big"
)

const maxTextLen = 300
var randTextBuf []byte


func randInt(bound int) int {
  n, _ := rand.Int(rand.Reader, big.NewInt(int64(bound)))
  return int(n.Int64())
}

func randText() string {
  if randTextBuf == nil {
    f, _ := os.Open("random.txt")
    fi, _ := f.Stat()
    randTextBuf = make([]byte, fi.Size)
    io.ReadFull(f, randTextBuf)
    f.Close()
  }

  start := randInt(len(randTextBuf) - maxTextLen)
  stop := start + randInt(maxTextLen)
  return string(randTextBuf[start:stop])
}

func reviewerIds(revs map[string]string) []string {
  ret := make([]string, len(revs))
  i := 0
  for id, _ := range(revs) {
    ret[i] = id
    i = i + 1
  }
  return ret
}

func randTime() float64 {
  now, _, _ := os.Time()
  delta := int64(randInt(3600 * 24 * 60)) // 3 months
  return float64(now - delta)
} 

func LoadRandomComments(dept *model.Dept) {
  apps, err := dept.Applications("0")
  if err != nil {
    panic(fmt.Sprintf("Applications failed, err=%v", err))
  }

  revs, err := dept.GetReviewerIdMap()
  if err != nil {
    panic(fmt.Sprintf("GetReviwerIdMap failed, err=%v", err))
  }

  revIds := reviewerIds(revs)

  for _, app := range(apps) {
    numComments := randInt(50)
    for i := 0; i < numComments; i = i + 1 {
      revId := revIds[randInt(len(revIds))]
      revName := revs[revId]
      com := &model.Comment{app["embarkId"].(string), model.ReviewerId(revId), 
                            revName, randTime(), randText()}
      err = dept.NewComment(com)
      if err != nil {
        panic(fmt.Sprintf("NewComment failed, com=%v, err=%v", com, err))
      }
    }
  }
}
/*
func Make(prefix string, numApps int) os.Error {
  dept, err := model.NewDept("localhost", "5984", prefix)
  if err != nil {
    panic(fmt.Sprintf("NewDept failed, err=%v", err))
  }

  apps := make([]*Application, numApps)
  for i, app := range(apps) {
    app = &Application{i, randFirstName(), randLastName(), randEmail(), randGPA(),
      randGRE(), randGRE(), randCountry(), 
    err = dept.NewApplication(app)
    if err != nil {
      panic(fmt.Sprintf("NewApplication failed, app=%v, err=%v", app, err))
    }
  }
}
*/
