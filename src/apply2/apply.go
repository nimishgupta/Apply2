package main

import (
	"crypto/rand"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"model"
	/* "os" */
	"server"
	"umass"
)

type DBConn struct {
  Host string
  Port string
}

var dbconn DBConn

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
	dept, err := model.LoadDept(dbconn.Host, dbconn.Port)
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
		if len(args) != 1 {
			fmt.Printf("missing argument; 'apply2 help umassimport' for information")
			return
		}
		file := args[0]
		umass.ImportCSV(dbconn.Host, dbconn.Port, file)
	},
	Short: "import CSV data from UMass",
	Usage: "FILENAME.CSV",
}

var cmdUMassPDFs = &Command {
	Run: func(args []string) {
		if len(args) != 1 {
			fmt.Printf("missing argument; 'apply2 help umasspdfs' for information")
			return
		}
		file := args[0]
		umass.ImportPDFs(file)
	},
	Short: "import PDF data from UMass",
	Usage: "DIRECTORY NAME",
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
		_, err := model.NewDept(dbconn.Host, dbconn.Port)
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
		dept, err := model.LoadDept(dbconn.Host, dbconn.Port)
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
		dept, err := model.LoadDept(dbconn.Host, dbconn.Port)
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
			server.Serve(dbconn.Host, dbconn.Port, rand16(), false)
		} else if len(args) == 1 {
			key, err := ioutil.ReadFile(args[0])
			if err != nil { panic (err) }
			server.Serve(dbconn.Host, dbconn.Port, key , false)
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
			server.Serve(dbconn.Host, dbconn.Port, rand16(), true)
		} else if len(args) == 1 {
			key, err := ioutil.ReadFile(args[0])
			if err != nil { panic (err) }
			server.Serve(dbconn.Host, dbconn.Port, key , true)
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
	"keygen": cmdKeygen,
	"deletedept": cmdDeleteDept,
	"newdept": cmdNewDept,
	"newreviewer": cmdNewReviewer,
	"loadapps": cmdLoadApps,
	"fastcgi": cmdFastCGI,
	"testserver": cmdTestServer,
	"umassimport": cmdUMassImport,
	"umasspdfs": cmdUMassPDFs,
}

func main() {

	flag.StringVar(&dbconn.Host, "dbhost", "localhost", "dbhost <ip/name>")
	flag.StringVar(&dbconn.Port, "dbport", "5984", "dbport <port>")

	flag.Parse ()

        var args []string = flag.Args ()

        // var args []string = os.Args

	if len(args) < 1 {
		fmt.Printf("Expected command. run 'apply2 help' for usage information.\n")
		return
	}

	// Compiler reports an "initialization loop" if help is placed in commands...
	if args[0] == "help" {
		runCmdHelp(args[1:])
		return
	}

	cmd, ok := commands[args[0]]
	if !ok {
		fmt.Printf("Command not found. Run 'apply2 help' for usage information.\n")
		return
	}

	cmd.Run(args[1:])
}
