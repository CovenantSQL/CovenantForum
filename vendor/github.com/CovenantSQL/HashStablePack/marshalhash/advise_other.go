// +build !linux appengine

package marshalhash

import (
	"os"
)

// TODO: darwin, BSD support

func adviseRead(mem []byte) {}

func adviseWrite(mem []byte) {}

func fallocate(f *os.File, sz int64) error {
	return f.Truncate(sz)
}
