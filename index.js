const {app, BrowserWindow, ipcMain, dialog, Notification, shell} = require("electron")
const ytdl = require("ytdl-core")
const fs = require("fs")
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path.replace("app.asar", "app.asar.unpacked");
console.log(ffmpegPath)
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const adapter = new FileSync('./settings.json')
const db = low(adapter)

const downloads = []

function createWindow() {
	const win = new BrowserWindow({
		width: 800,
		height: 600,
		autoHideMenuBar: true,
		icon: __dirname + "/src/youtube.png",
		webPreferences: {
			nodeIntegration: true
		}
	})
	win.loadFile("src/index.html")
	win.webContents.on("will-navigate", (event, url) => {
		event.preventDefault()
		shell.openExternal(url)
	})
	//win.webContents.openDevTools()
}

console.log(__dirname)

app.whenReady().then(createWindow)

Array.prototype.remove = function(element) {
	if(typeof element === "function") {
		element = this.find(element)
	}
	if(!element) return
	this.splice(this.indexOf(element), 1)
}

app.on("window-all-closed", () => {
	if(process.platfarm !== "darwin") {
		app.quit()
	}
})

ipcMain.on("getInfo", async (event, args) => {
	try {
		const info = await ytdl.getInfo(args.url).catch(e => event.reply("error", e))
		if(!info) return
		event.reply(args.current ? "receiveCurrentVideoInfo" : "receiveInfo", info, args)
	} catch(e) {
		event.reply("error", e)
	}
})

ipcMain.on("downloadVideo", async (event, args) => {
	try {
		const video = await ytdl(args.url, {quality: "highest"})
		const path = fs.existsSync(db.get("dest").value()) ? db.get("dest").value() : require("os").homedir()
		args.filePath = path + "/" + args.fileName
		const stream = video.pipe(fs.createWriteStream(path + "/" + args.fileName + ".mp4"))
		downloads.push({
			video, stream, ...args
		})
		video.on("progress", (chunk, downloaded, total) => {
			const percent = downloaded / total * 100
			event.reply("downloadProgress", {chunk, downloaded, total, percent, url: args.url, id: args.id, format: args.format})
		})
		stream.once("finish", () => {
			new Notification({title: "Download finished", body: args.fileName, icon: __dirname + "/src/youtube.png"}).show()
			downloads.remove(s => s.id === args.id)
			event.reply("downloadFinish", args)
		})
		stream.once("error", (e) => {
			downloads.remove(s => s.id === args.id)
			event.reply("error", e)
		})
		video.once("error", (e) => {
			downloads.remove(s => s.id === args.id)
			event.reply("error", e)
		})
	} catch(e) {
		downloads.remove(s => s.id === args.id)
		event.reply("error", e)
	}
})

ipcMain.on("cancelDownload", async (event, args) => {
	try {
		const stream = downloads.find(a => a.id === args)
		if(!stream) return
		stream.video.destroy()
		fs.unlink(stream.filePath + ".mp4", (e) => {
			if(e) throw e
			downloads.remove(s => s.id === args)
			event.reply("downloadFinish", {format: "na", id: args})
		})
	} catch(e) {
		downloads.remove(s => s.id === args)
		event.reply("error", e)
	}
})

ipcMain.on("formatVideo", async (event, args) => {
	try {
		const proc = new ffmpeg({source: args.filePath + ".mp4"})
		proc.withAudioCodec("libmp3lame")
		.toFormat("mp3")
		.output(args.filePath + ".mp3")
		.run()
		proc.on("progress", progress => {
			event.reply("formatProgress", {...args, percent: progress.percent ? progress.percent.toFixed(0) : null})
		})
		.once("end", () => {
			fs.unlink(args.filePath + ".mp4", (e) => {
				if(e) throw e
			})
			new Notification({title: "Format finished", body: args.fileName, icon: __dirname + "/src/youtube.png"}).show()
			event.reply("formatFinish", args)
		})
	} catch(e) {
		event.reply("error", e)
	}
})

ipcMain.on("setDestPath", async (event) => {
	try {
		const result = await dialog.showOpenDialog({
	    	properties: ['openDirectory']
		})
		if(result.canceled) return
		const path = result.filePaths[0]
		if(!path) return
		if(!fs.existsSync(path)) return
		db.set("dest", path).write()
		event.reply("destPathUpdate", path)
	} catch(e) {
		event.reply("error", e)
	}
})

ipcMain.on("getDestPath", async (event) => {
	try {
		let path = db.get("dest").value() || require("os").homedir()
		if(!fs.existsSync(path)) path = require("os").homedir()
		event.returnValue = path
	} catch(e) {
		event.reply("error", e)
	}
})

app.on("activate", () => {
	if(BrowserWindow.getAllWindows().length === 0) {
		createWindow()
	}
})