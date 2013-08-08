# Apply2


## Dependencies

- [TypeScript] to build the client-side code (tested with version 0.9.0.1)
- [Mercurial] to fetch Go dependencies
- [Go] to build the server-side code (tested with version 1.0.3)
- [CouchDB] to run the database server (tested with version 1.3.1)
- [Nginx] to run the Web server (only required for deployment; tested with version 1.4.1)

## MacOS X + Homebrew Development Instructions

[Homebrew] is a nice package manager that you can use to install most
dependencies.

- Install prerequisites:

    $ brew install npm go mercurial
    $ npm install -g typescript@0.9.0-1

  To run CouchDB, use the [CouchDBX] application. You could install CouchDB via
  Homebrew. But, that requires building Erlang, which takes a long time.

- Fetch code and build:

        $ git clone https://github.com/plasma-umass/Apply2.git
        $ cd Apply2
        $ ./configure
        $ make

- Create and run a sample department:

        $ ./apply2 sample mydept
        $ ./apply2 newreviewer mydept scooby redbull64 "Scooby Doo"
        $ ./apply2 testserver mydept sample

- Visit http://localhost:8080/disembark.html using Firefox, Chrome, or Safari (Internet Explorer
  will not work).


## Development Tips [FILL]


    $ tsc --sourcemap --module amd -w disembark.ts

## Deployment [FILL]


[TypeScript]: http://www.typescriptlang.org
[Mercurial]: http://mercurial.selenic.com
[Go]: http://code.google.com/p/go/
[Nginx]: http://wiki.nginx.org/Main
[CouchDB]: http://couchdb.apache.org
[Homebrew]: http://brew.sh
[CouchDBX]: http://www.apache.org/dyn/closer.cgi?path=/couchdb/binary/mac/1.3.1/Apache-CouchDB-1.3.1.zip
