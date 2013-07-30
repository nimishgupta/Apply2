# Apply2


## Dependencies

- [TypeScript] to build the client-side code (tested with version 0.9.0.1)
- [Mercurial] to fetch Go dependencies
- [Go] to build the server-side code (tested with version 1.0.3)
- [Nginx] to run the Web server (tested with version 1.4.1)
- [CouchDB] to run the database server (tested with version 1.3.1)


## MacOS X + Homebrew Instructions

[Homebrew] is a nice package manager that you can use to install several
dependencies.

    $ brew install npm go mercurial nginx
    $ npm install -g typescript

To run CouchDB, use the [CouchDBX] application. (You can install CouchDB via
Homebrew, but that requires building Erlang, which takes a long time.)

## Configuration Instructions

Create a sample department:

    server $ ./main -dept cs
    server $ cd ../sample
    server $ ../server/main -load demo-data.json sample
    server $ ../server/main -serve . cs


## Development

    $ tsc --sourcemap --module amd -w *.ts



[TypeScript]: http://www.typescriptlang.org
[Mercurial]: http://mercurial.selenic.com
[Go]: http://code.google.com/p/go/
[Nginx]: http://wiki.nginx.org/Main
[CouchDB]: http://couchdb.apache.org
[Homebrew]: http://brew.sh
[CouchDBX]: http://www.apache.org/dyn/closer.cgi?path=/couchdb/binary/mac/1.3.1/Apache-CouchDB-1.3.1.zip