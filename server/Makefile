pkgdir := $(shell go env GOOS)_$(shell go env GOARCH)

GOPATH := $(CURDIR)
export GOPATH

all: pkg/$(pkgdir)/code.google.com/p/couch-go.a pkg/$(pkgdir)/github.com/tonnerre/go-ldap.a
	go build main

pkg/$(pkgdir)/code.google.com/p/couch-go.a:
	go get code.google.com/p/couch-go

pkg/$(pkgdir)/github.com/tonnerre/go-ldap.a: pkg/$(pkgdir)/github.com/tonnerre/asn1-ber.a
	go get github.com/tonnerre/go-ldap

pkg/$(pkgdir)/github.com/tonnerre/asn1-ber.a:
	go get github.com/tonnerre/asn1-ber
	rm -f src/github.com/mmitton
	ln -s tonnerre src/github.com/mmitton

test:
	go test caps
	go test model

clean:
	rm -rf main pkg src/code.google.com src/github.com
