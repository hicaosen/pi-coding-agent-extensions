# pi-coding-agent-extensions

A collection of extensions for [pi-coding-agent](https://github.com/nicepkg/pi-coding-agent) — the open-source AI coding agent that runs in your terminal.

## Extensions

### proactive-compact

Automatically monitors and manages context window usage. When context exceeds a configurable threshold, it compacts the context and auto-resumes if the agent was mid-task — no manual intervention needed.

**Features**

- 📊 Real-time context usage indicator in the status bar
- ⚡ Auto-compaction when usage exceeds threshold
- 🔄 Seamless auto-resume for interrupted tasks
- 🎛️ Configurable threshold (default: 30%)

**Usage**

```bash
pi --extension proactive-compact.ts

# Custom threshold (e.g. 50%)
pi --extension proactive-compact.ts --compact-threshold 50
```

## Contributing

Contributions are welcome! Feel free to submit a PR with your extension.

1. Add your extension file to the repository root
2. Update this README with a description of your extension
3. Submit a pull request

## License

[MIT](LICENSE)
