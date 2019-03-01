// CovenantSQL is a simple discussion board / forum web application.
// The forum command is a command-line tool that manages the forum web server.
package main

import (
	"flag"
	"fmt"
	"log"
	"os"
)

var (
	logger       = log.New(os.Stdout, "", log.LstdFlags|log.LUTC)
	useEnvConfig = flag.Bool("e", false, "use environment variables as config")
)

func main() {
	flag.Usage = help
	flag.Parse()

	cmds := map[string]func(){
		"start":        startServer,
		"init":         initConfig,
		"gen-key":      genKey,
		"admins":       printAdmins,
		"add-admin":    addAdmin,
		"remove-admin": removeAdmin,
		"help":         help,
	}

	if cmdFunc, ok := cmds[flag.Arg(0)]; ok {
		cmdFunc()
	} else {
		help()
		os.Exit(2)
	}
}

func help() {
	fmt.Fprintln(os.Stderr, `Usage:
	forum start                      - start the server
	forum init                       - create an initial configuration file
	forum gen-key                    - generate a random 32-byte hex-encoded key
	forum admins                     - show the admin list
	forum add-admin <username>       - add a user to the admin list
	forum remove-admin <username>    - remove a user from the admin list
	forum help                       - show this message
Use -e flag to read configuration from environment variables instead of a file. E.g.:
	forum -e start
	forum -e admins`)
}
