const path = require('path');
const fse = require('fs-extra');
const multiparty = require('multiparty');

const UPLOAD_DIR = path.join(__dirname, 'uploads');

module.exports = class {

	async handleUpload(req, res) {
		const multi = new multiparty.Form();
		multi.parse(req, async (err, fields, files) => {
			if(err) {
				res.statusCode = 500;
				res.end();
				return;
			}
			const [chunk] = files.chunk;
			const [hash] = fields.hash;
			const [filename] = fields.filename;
			const [fileHash] = fields.fileHash;
			const chunkDir = path.resolve(UPLOAD_DIR, `${fileHash}`);

			if(!fse.existsSync(chunkDir)) {
				await fse.mkdirs(chunkDir);
			}

			await fse.move(chunk.path, `${chunkDir}/${hash}`);
			res.end('received file chunk');
		});
	}
	
	async handleMerge(req, res) {
		const data = await parseRequest(req);
		const filename = data.filename;
		const fileHash = data.fileHash;
		const extension = getExtension(filename);
		const size = data.size;
		const filePath = path.resolve(UPLOAD_DIR, `${fileHash}${extension}`);
		await mergeFileChunks(filePath, fileHash, size);
		res.end('merged file chunks');
	}

	async handleVerifyFile(req, res) {
		const data = await parseRequest(req);
		const fileHash = data.fileHash;
		const filename = data.filename;
		const extension = getExtension(filename);
		const filePath = path.resolve(UPLOAD_DIR, `${fileHash}${extension}`);
		if(fse.existsSync(filePath)) {
			res.end(JSON.stringify({exists: true}));
		} else {
			res.end(JSON.stringify({
				exists: false,
				chunks: await getChunks(fileHash),
			}));
		}
	}


}


async function parseRequest(req) {
	return new Promise(resolve => {
		let chunk = "";
		req.on("data", data => {
			chunk += data;
		});
		req.on("end", () => {
			resolve(JSON.parse(chunk));
		});
	});
}


async function mergeFileChunks(filePath, fileHash, size) {
	const chunkDir = path.resolve(UPLOAD_DIR, `${fileHash}`);
	const chunkPaths = await fse.readdir(chunkDir);
	const regex = new RegExp(`${fileHash}`);
	const mergeFiles = chunkPaths.filter((name) => { if (name.match(regex)) return name; }).
	sort((a, b) => { return a.split('-')[1] - b.split('-')[1] });
	let tasks = mergeFiles.map((chunkPath, index) => {
		return pipeStream(path.resolve(chunkDir, chunkPath), fse.createWriteStream(filePath, { start: index * size }));
	});
	await Promise.all(tasks);
	fse.rmdirSync(chunkDir);
}


async function pipeStream(path, writeStream) {
	return new Promise(resolve => {
		const readStream = fse.createReadStream(path);
		readStream.on('end', () => {
			fse.unlinkSync(path);
			resolve();
		});
		readStream.pipe(writeStream);
	})
}


function getExtension(filename) {
	return filename.slice(filename.lastIndexOf('.'), filename.length);
}


async function getChunks(fileHash) {
	return fse.existsSync(path.resolve(UPLOAD_DIR, fileHash)) ? await fse.readdir(path.resolve(UPLOAD_DIR, fileHash)) : [];
}
