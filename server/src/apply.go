package main

import (
  "fmt"
  "os"
  "crypto/rand"
  "io/ioutil"
	"model"
	"json"
	"server"
  "sample"
)

func keygen(file string) {
  key := [16]byte{}
  num, err := rand.Read(key[:])
  if err != nil {
    panic(err)
  }
  if num != 16 {
    panic(fmt.Sprintf("Only read %v bytes from Rand.read", num));
  }

  err = ioutil.WriteFile(file, key[:], 0600)
  if (err != nil) {
    panic(err)
  }
}

func deleteDept(deptName string) {
	dept, err := model.LoadDept("localhost", "5984", deptName)
	if err != nil {
		panic(fmt.Sprintf("department does not exist %v", err))
	}

  dept.Delete()
	return
}

func main() {

  if len(os.Args) == 0 {
    fmt.Printf("expected arguments")
    os.Exit(1)
  }

  switch os.Args[1] {
  case "-sample-comments":
    deptName := os.Args[2]
    dept, _ := model.LoadDept("localhost", "5984", deptName)
    sample.LoadRandomComments(dept)
  case "-keygen":
    keygen(os.Args[2])
	case "-delete-dept":
    deleteDept(os.Args[2])
	case "-dept":
		dept, err := model.NewDept("localhost", "5984", os.Args[2])
		if (err != nil) { panic(err) }
		dept.NewReviewer(model.ReviewerId("arjun"), "Arjun Guha", "redbull64")
	case "-load":
		src, err := ioutil.ReadFile(os.Args[2])
	  if (err != nil) { panic(err) }
    var applications []model.Application
    err = json.Unmarshal(src, &applications)
	  if (err != nil) { panic(err) }
		dept, err := model.LoadDept("localhost", "5984", os.Args[3])
	  if (err != nil) { panic(err) }
	  for _, app := range applications {
	  	err = dept.NewApplication(app)
			if (err != nil) { panic(err) }
	  }
  case "-serve":
    server.Serve(os.Args[2], os.Args[3])
  default:
    fmt.Printf("unrecognized argument")
  }
}
