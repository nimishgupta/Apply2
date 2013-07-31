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

type Command struct {
	Run func(args []string)
	Short string
	Usage string
}

var cmdSample = &Command {
	Run: func(args [] string) {
		if len(args) != 1 {
			fmt.Printf("missing argument; 'apply2 help sample' for information")
			return
		}
		deptName := args[0]
		dept, err := model.NewDept("localhost", "5984", deptName)
		if err != nil {
			panic(err)
		}
		sample.Populate(dept)
	},
	Short: "create a sample department",
}

var cmdKeygen = &Command {
	Run: func (args [] string) {
		if len(args) != 1 {
			fmt.Printf("missing argument; 'apply2 help keygen' for information")
			return
		}
		keygen(args[0])
	},
	Short: "generate a private key for Web access",
}

var cmdDeleteDept = &Command {
	Run: func (args []string) {
		if len(args) != 1 {
			fmt.Printf("missing argument; 'apply2 help deletedept' for information")
			return
		}
		deleteDept(args[0])
	},
	Short: "permanently delete a department from the database",
}

var cmdNewDept = &Command {
	Run: func(args []string) {
		_, err := model.NewDept("localhost", "5984", os.Args[2])
		if err != nil {
			panic(err)
		}
	},
	Short: "create a new, empty department",
}

var cmdNewReviewer = &Command {
	Short: "create a new reviewer account",
	Usage: `DEPT_ID USERNAME PASSWORD "Full Name"`,
	Run: func(args []string) {
		dept, err := model.LoadDept("localhost", "5984", args[0])
		if err != nil {
			panic(err)
		}
		dept.NewReviewer(model.ReviewerId(args[1]), args[3], args[2])
		if err != nil {
			panic(err)
		}
	},
}

var cmdLoadApps = &Command {
	Short: "load applicant information",
	Usage: `DEPT_ID DEPTH_PATH`,
	Run: func(args []string) {
		src, err := ioutil.ReadFile(args[1])
		if err != nil {
			panic(err)
		}
		var applications []model.Application
		err = json.Unmarshal(src, &applications)
		if err != nil {
			panic(err)
		}
		dept, err := model.LoadDept("localhost", "5984", args[0])
		if err != nil {
			panic(err)
		}
		for _, app := range applications {
			err = dept.NewApplication(app)
			if err != nil {
				panic(err)
			}
		}
	},
}

var cmdFastCGI = &Command {
	Short: "run apply2 FastCGI server",
	Usage: "DEPT_ID DEPT_DIR",
	Run: func(args []string) {
		server.Serve(args[1], args[0], false)
	},
}

var cmdTestServer = &Command {
	Short: "run a test server",
	Usage: `DEPT_ID DEPT_PATH`,
	Run: func(args []string) {
		server.Serve(args[1], args[0], true)
	},
}

func runCmdHelp(args []string) {
	if len(args) > 1 {
		fmt.Print("Too many arguments.\n")
		return
	}

	if len(args) == 1 {
		cmd, ok := commands[args[0]]
		if !ok {
			fmt.Print("No such command. Run 'apply2 help' for a list of commands.\n")
			return
		}
		if cmd.Usage == "" {
			fmt.Print("Usage instructions missing. Please report.\n")
			return
		}
		fmt.Printf("usage: apply2 %v ", args[0])
		fmt.Print(cmd.Usage)
		fmt.Print("\n")
		return
	}

	for keyword, cmd := range commands {
		fmt.Printf("  apply2 %-12v %v\n", keyword, cmd.Short)
	}
	return
}

var commands = map[string]*Command{
	"sample": cmdSample,
	"keygen": cmdKeygen,
	"deletedept": cmdDeleteDept,
	"newdept": cmdNewDept,
	"newreviewer": cmdNewReviewer,
	"loadapps": cmdLoadApps,
	"fastcgi": cmdFastCGI,
	"testserver": cmdTestServer,
}

func main() {

	if len(os.Args) < 2 {
		fmt.Printf("Expected command. run 'apply2 help' for usage information.\n")
		return
	}

	// Compiler reports an "initialization loop" if help is placed in commands...
	if os.Args[1] == "help" {
		runCmdHelp(os.Args[2:])
		return
	}

	cmd, ok := commands[os.Args[1]]
	if !ok {
		fmt.Printf("Command not found. Run 'apply2 help' for usage information.\n")
		return
	}

	cmd.Run(os.Args[2:])
}