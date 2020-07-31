const handleError = require("./scripts/handleError.js")
const { shell, ipcRenderer } = require('electron')

function openGithub() {
	shell.openExternal("https://github.com/Guaxinim5573/video-downloader")
}

function loadSettings() {
	$("#destPath").val(ipcRenderer.sendSync("getDestPath"))
	$("#settingsModal").modal("show")
}

function getDestPath() {
	return ipcRenderer.sendSync("getDestPath")	
}

function setDestPath() {
	ipcRenderer.send("setDestPath")
}

ipcRenderer.on("destPathUpdate", (event, newPath) => {
	$("#destPath").val(newPath)
})

function download(format) {
	const url = $("#url").val()
	$("#mp3").prop("disabled", true)
	$("#mp4").prop("disabled", true)
	$("#spin-" + format).css("display", "")
	ipcRenderer.send("getInfo", {url, format})
}

function cancelDownload(id) {
	$("#video-" + id + "-cancel").prop("disabled", true)
	$("#video-" + id + "-spin").css("display", "")
	ipcRenderer.send("cancelDownload", id)
}

function getInfo() {
	const url = $("#url").val()
	$("#url").prop("disabled", true)
	$("#spin").css("display", "")
	$("#spin-btn").prop("disabled", true)
	ipcRenderer.send("getInfo", {url, current: true})
}

function Video(video, id) {
	return `
	<div id="video-${id}">
		<img src="${video.thumbnail.thumbnails[0].url}" class="float-left video-thumbnail" width="181px" height="100px" alt="video-thumbnail">
		<span style="font-size:18px;">${video.title}</span><br>
		<button class="btn btn-danger" onclick="cancelDownload('${id}')" id="video-${id}-cancel"><span id="video-${id}-spin" class="spinner-border spinner-border-sm" style="display:none;"></span> &times; Stop</button><br>
		<span style="font-size:12px;" id="video-${id}-span">Downloaded XX.XXMB of XXX.XXXMB</span>
		<div class="progress video-progress">
			<div class="progress-bar bg-success" id="video-${id}-percent" style="width:0%">20%</div>
		</div>
	</div><br>
			`
}

ipcRenderer.on("receiveInfo", (event, args, {format}) => {
	let id;
	do {
		id = args.videoDetails.videoId + Math.floor(Math.random() * 99999)
	} while($("#video-" + id).length !== 0)
	id = args.videoDetails.videoId + id
	$("#downloadModal").modal("hide")
	$("#url").val("")
	$("#videos").append(Video(args.videoDetails, id))
	$("#mp3").prop("disabled", false)
	$("#mp4").prop("disabled", false)
	$("#spin-" + format).css("display", "none")
	ipcRenderer.send("downloadVideo", {
		url: args.videoDetails.video_url,
		id: id,
		fileName: args.videoDetails.title.replace(/\\|\/|\?|:|"|\*|<|>|\|/gm, "-") + id || "unknown-" + id,
		format,
		details: args.videoDetails
	})
})

ipcRenderer.on("receiveCurrentVideoInfo", (event, args) => {
	$("#downloadModal").modal("show")
	$("#url").prop("disabled", false)
	$("#spin").css("display", "none")
	$("#spin-btn").prop("disabled", false)
	$("#current-video-thumbnail").prop("src", args.videoDetails.thumbnail.thumbnails[0].url)
	$("#current-video-title").text(args.videoDetails.title)
	$("#current-video-channel-img").prop("src", args.videoDetails.author.avatar)
	$("#current-video-channel-name").text(args.videoDetails.author.name)
})

ipcRenderer.on("downloadProgress", (event, args) => {
	$(`#video-${args.id}-percent`).text(args.percent.toFixed(0) + "%")
	$(`#video-${args.id}-percent`).css("width", `${args.percent.toFixed(0)}%`)
	$(`#video-${args.id}-span`).text(`Downloaded ${(args.downloaded / 1024 / 1024).toFixed(2)}MB of ${(args.total / 1024 / 1024).toFixed(2)}MB`)
})

ipcRenderer.on("formatProgress", (event, args) => {
	if(args.percent) {
		$(`#video-${args.id}-percent`).text(args.percent + "%")
		$(`#video-${args.id}-percent`).css("width", args.percent + "%")
	}
	$(`#video-${args.id}-span`).text(`Formatting...`)
})

ipcRenderer.on("downloadFinish", (event, args) => {
	if(args.format === "mp3") {
		$("#video-" + args.id + "-cancel").css("display", "none")
		ipcRenderer.send("formatVideo", args)
	}
	else $("#video-" + args.id).remove()
})

ipcRenderer.on("formatFinish", (event, args) => {
	console.log("Format finish")
	$("#video-" + args.id).remove()
})

function Toast(title, body) {
	let id;
	do {
		id = Math.floor(Math.random() * 99999)
	} while($("#" + id).length !== 0)

	$("#toasts").append(`
		<div class="toast" role="alert" data-delay="5000" id="${id}">
			<div class="toats-header">
				<strong class="mr-auto" style="margin-righ:5px;margin-left:5px;">${title}</strong>
				<button type="button" class="close" data-dismiss="toast">×</button>
			</div>
			<div class="toast-body">${body}</div>
		</div>
		`)
	$("#" + id).toast("show")
	//return id
}

const knowErrors = [{
	message: "No video found",
	regex: new RegExp("no video id found", "i")
}, {
	message: "Invalid link",
	regex: new RegExp("Not a YouTube domain", "i")
}]
ipcRenderer.on("error", (event, args) => {
	console.log(args)
	$("#url").prop("disabled", false)
	$("#url").val("")
	$("#spin").css("display", "none")
	$("#spin-btn").prop("disabled", false)
	const custom = knowErrors.find(e => e.regex.test(args.message))
	if(custom){
		Toast("Oh no!", custom.message)
	} else {
		Toast("There is a unexpected error", (args.stack || args.message || args))
	}
})