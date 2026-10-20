package main

import (
	"bytes"
	"fmt"
	"log"
	"net"
	"os/exec"
	"strings"
	"time"
)

// child is one server process. Its output goes to the launcher's log, prefixed with its name.
type child struct {
	name string
	cmd  *exec.Cmd
}

// exit reports that a child process has ended.
type exit struct {
	name string
	err  error
}

func startChild(name string, env []string, bin string, args ...string) (*child, error) {
	cmd := exec.Command(bin, args...)
	cmd.Env = env
	cmd.Stdout = &lineLog{name: name}
	cmd.Stderr = &lineLog{name: name}
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start %s: %w", name, err)
	}
	return &child{name: name, cmd: cmd}, nil
}

// watch reports the child's exit on exits. Only this goroutine calls Wait.
func watch(c *child, exits chan<- exit) {
	go func() {
		exits <- exit{name: c.name, err: c.cmd.Wait()}
	}()
}

// lineLog writes each complete line of a child's output to the log. Writes come from one goroutine.
type lineLog struct {
	name string
	buf  bytes.Buffer
}

func (l *lineLog) Write(p []byte) (int, error) {
	l.buf.Write(p)
	for {
		line, err := l.buf.ReadString('\n')
		if err != nil {
			// The line is not complete yet. Keep the part that was read until the rest arrives.
			l.buf.WriteString(line)
			break
		}
		log.Printf("[%s] %s", l.name, strings.TrimRight(line, "\r\n"))
	}
	return len(p), nil
}

// waitPort waits until something accepts connections on addr.
func waitPort(addr string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for {
		c, err := net.DialTimeout("tcp", addr, time.Second)
		if err == nil {
			c.Close()
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("nothing listens on %s after %s", addr, timeout)
		}
		time.Sleep(time.Second)
	}
}
