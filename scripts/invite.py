#!/usr/bin/python
import os

# PASS = "fill a default password"

invitees = \
  [("aritz@cs.brown.edu", "Anna Ritz"),
   ("jadrian@cs.brown.edu", "Jadrian Miles"),
   ("jennie@cs.brown.edu", "Jennie Duggan"),
   ("wzhou@cs.brown.edu", "Wenjin Zhou"),
   ("cad@cs.brown.edu", "Cagatay Demiralp"),
   ("jr@cs.brown.edu", "Radu Jainu"),

for inv in invitees:
  cmd = './apply -user cs %s "%s" %s' % (inv[0], inv[1], PASS)
  print cmd
  os.system(cmd)
