package main

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"model"
	"os"
	"sample"
	"server"
)

func keygen(file string) {
	key := [16]byte{}
	num, err := rand.Read(key[:])
	if err != nil {
		panic(err)
	}
	if num != 16 {
		panic(fmt.Sprintf("Only read %v bytes from Rand.read", num))
	}

	err = ioutil.WriteFile(file, key[:], 0600)
	if err != nil {
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

	if len(os.Args) == 1 {
		fmt.Printf("expected arguments\n")
		os.Exit(1)
	}

	switch os.Args[1] {
	case "-sample":
		deptName := os.Args[2]
		dept, _ := model.LoadDept("localhost", "5984", deptName)
		sample.Populate(dept)
	case "-keygen":
		keygen(os.Args[2])
	case "-delete-dept":
		deleteDept(os.Args[2])
	case "-dept":
		dept, err := model.NewDept("localhost", "5984", os.Args[2])
		if err != nil {
			panic(err)
		}
		dept.NewReviewer(model.ReviewerId("arjun"), "Arjun Guha", "redbull64")
	case "-user":
		dept, err := model.LoadDept("localhost", "5984", os.Args[2])
		if err != nil {
			panic(err)
		}
		dept.NewReviewer(model.ReviewerId(os.Args[3]), os.Args[4], os.Args[5])
		if err != nil {
			panic(err)
		}
	case "-load":
		src, err := ioutil.ReadFile(os.Args[2])
		if err != nil {
			panic(err)
		}
		var applications []model.Application
		err = json.Unmarshal(src, &applications)
		if err != nil {
			panic(err)
		}
		dept, err := model.LoadDept("localhost", "5984", os.Args[3])
		if err != nil {
			panic(err)
		}
		for _, app := range applications {
			err = dept.NewApplication(app)
			if err != nil {
				panic(err)
			}
		}
	case "-load-comments":
		src, err := ioutil.ReadFile(os.Args[2])
		if err != nil {
			panic(err)
		}
		var comments []model.Comment
		err = json.Unmarshal(src, &comments)
		if err != nil {
			panic(err)
		}
		dept, err := model.LoadDept("localhost", "5984", os.Args[3])
		if err != nil {
			panic(err)
		}
		for _, com := range comments {
			err = dept.NewComment(&com)
			if err != nil {
				panic(err)
			}
		}
	case "-load-scores":
		src, err := ioutil.ReadFile(os.Args[2])
		if err != nil {
			panic(err)
		}
		var scores []model.Score
		err = json.Unmarshal(src, &scores)
		if err != nil {
			panic(err)
		}
		dept, err := model.LoadDept("localhost", "5984", os.Args[3])
		if err != nil {
			panic(err)
		}
		for _, sco := range scores {
			err = dept.SetScore(&sco)
			if err != nil {
				panic(err)
			}
		}
	case "-serve":
		server.Serve(os.Args[2], os.Args[3])
	default:
		fmt.Printf("unrecognized argument\n")
	}
}
