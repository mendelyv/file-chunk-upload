const http = require('http');
const fse = require('fs-extra');
const path = require('path');
const multiparty = require('multiparty');
const Controller = require('./controller');

const server = http.createServer();
const controller = new Controller();

server.on("request", async (req, res) => {
	res.setHeader("access-control-allow-origin", "*");
	res.setHeader("access-control-allow-headers", "*");
	if(req.method === "OPTIONS") {
		res.status = 200;
		res.end();
		return;
	}

	if(req.url === "/") {
		await controller.handleUpload(req, res);
	}

	if(req.url === '/merge') {
		await controller.handleMerge(req, res);
		return;
	}

	if(req.url === '/verify') {
		await controller.handleVerifyFile(req, res);
		return;
	}

});

server.listen(9339, () => { console.log("Server started on port 9339") });
