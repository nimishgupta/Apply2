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
	"umass"
)

func rand16() []byte {
	key := [16]byte{}
	num, err := rand.Read(key[:])
	if err != nil {
		panic(err)
	}
	if num != 16 {
		panic(fmt.Sprintf("Only read %v bytes from Rand.read", num))
	}
	return key[:]
}

func keygen(file string) {
	err := ioutil.WriteFile(file, rand16(), 0600)
	if err != nil {
		panic(err)
	}
}

func deleteDept() {
	dept, err := model.LoadDept("localhost", "5984")
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

var cmdUMassImport = &Command {
	Run: func(args []string) {
		if len(args) != 2 {
			fmt.Printf("missing argument; 'apply2 help umassimport' for information")
			return
		}
		dept := args[0]
		file := args[1]
		umass.ImportCSV(dept, file)
	},
	Short: "import CSV data from UMass",
	Usage: "DEPT_ID FILENAME.CSV",
}

var cmdSample = &Command {
	Run: func(args [] string) {
		if len(args) != 0 {
			fmt.Printf("too many arguments; 'apply2 help sample' for information")
			return
		}
		dept, err := model.NewDept("localhost", "5984")
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
		if len(args) != 0 {
			fmt.Printf("too many arguments; 'apply2 help deletedept' for information")
			return
		}
		deleteDept()
	},
	Short: "permanently delete a department from the database",
}

var cmdNewDept = &Command {
	Run: func(args []string) {
		_, err := model.NewDept("localhost", "5984")
		if err != nil {
			panic(err)
		}
	},
	Short: "create a new, empty department",
}

var cmdNewReviewer = &Command {
	Short: "create a new reviewer account",
	Usage: `USERNAME PASSWORD "Full Name"`,
	Run: func(args []string) {
		dept, err := model.LoadDept("localhost", "5984")
		if err != nil {
			panic(err)
		}
		dept.NewReviewer(model.ReviewerId(args[0]), args[2], args[1])
		if err != nil {
			panic(err)
		}
	},
}

var cmdLoadApps = &Command {
	Short: "load applicant information",
	Usage: `DEPT_PATH`,
	Run: func(args []string) {
		src, err := ioutil.ReadFile(args[0])
		if err != nil {
			panic(err)
		}
		var applications []model.Application
		err = json.Unmarshal(src, &applications)
		if err != nil {
			panic(err)
		}
		dept, err := model.LoadDept("localhost", "5984")
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
	Usage: "[KEY]",
	Run: func(args []string) {
		if len(args) == 0 {
			fmt.Printf("Generated random key. Any running sessions will fail.\n")
			server.Serve(rand16(), false)
		} else if len(args) == 1 {
			key, err := ioutil.ReadFile(args[0])
			if err != nil { panic (err) }
			server.Serve(key , false)
		}	else {
			fmt.Print("Invalid arguments. Run 'apply2 help'.\n")
		}
	},
}

var cmdTestServer = &Command {
	Short: "run a test server",
	Usage: `[KEY]`,
	Run: func(args []string) {
		if len(args) == 0 {
			fmt.Printf("Generated random key. Any running sessions will fail.\n")
			server.Serve(rand16(), true)
		} else if len(args) == 1 {
			key, err := ioutil.ReadFile(args[0])
			if err != nil { panic (err) }
			server.Serve(key , true)
		}	else {
			fmt.Print("Invalid arguments. Run 'apply2 help'.\n")
		}
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
	"umassimport": cmdUMassImport,
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