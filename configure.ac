AC_INIT(Apply2, 1.0)

AC_MSG_CHECKING([for TypeScript (tsc)])
TSC_PATH=`which tsc`
AC_MSG_RESULT($TSC_PATH)
if [[ -z "$TSC_PATH" ]]; then
	AC_MSG_ERROR([TypeScript 0.9.0.1 required])
fi

AC_MSG_CHECKING([TypeScript version])
TSC_VERSION=`tsc --version`
AC_MSG_RESULT($TSC_VERSION)
if [[ "$TSC_VERSION" != "Version 0.9.0.1" ]]; then
  AC_MSG_ERROR([TypeScript 0.9.0.1 required])
fi

AC_MSG_CHECKING([for Go])
GO_PATH=`which go`
AC_MSG_RESULT($GO_PATH)
if [[ -z "$GO_PATH" ]]; then
	AC_MSG_ERROR([Go 1.0.3 required])
fi

AC_MSG_CHECKING([Go version])
GO_VERSION=`go version`
AC_MSG_RESULT($GO_VERSION)
if [[ "$GO_VERSION" != "go version go1.0.3" ]]; then
	AC_MSG_ERROR([Go 1.0.3 required])
fi

AC_MSG_CHECKING([for curl])
CURL_PATH=`which curl`
AC_MSG_RESULT($CURL_PATH)
if [[ -z "$CURL_PATH" ]]; then
	AC_MSG_ERROR([Curl required])
fi

AC_PROG_GREP()

AC_MSG_CHECKING([for CouchDB])
COUCH_FOUND=`curl -s localhost:5984 | $GREP -c 1.3.1`
if [[ $COUCH_FOUND != 1 ]]; then
	AC_MSG_RESULT([no])
	AC_MSG_ERROR([Requires CouchDB 1.3.1 running on localhost:5984.])
fi
AC_MSG_RESULT([localhost:5984])

AC_MSG_CHECKING([for Mercurial])
HG_PATH=`which hg`
AC_MSG_RESULT($HG_PATH)
if [[ -z "$HG_PATH" ]]; then
	AC_MSG_ERROR([Mercurial (hg) required])
fi

AC_MSG_NOTICE([Everything seems fine. Running 'make' should work.])