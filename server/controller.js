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
			const chunkDir = path.resolve(UPLOAD_DIR, 'chunkDir' + filename);

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
		const size = data.size;
		const filePath = path.resolve(UPLOAD_DIR, filename);
		await mergeFileChunks(filePath, filename, size);
		res.end('merged file chunks');
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


async function mergeFileChunks(filePath, filename, size) {
	const chunkDir = path.resolve(UPLOAD_DIR, 'chunkDir' + filename);
	const chunkPaths = await fse.readdir(chunkDir);
	chunkPaths.sort((a, b) => { return a.split('-')[1] - b.split('-')[1] });
	await Promise.all(
		chunkPaths.map((chunkPath, index) => {
			pipeStream(path.resolve(chunkDir, chunkPath),
			fse.createWriteStream(filePath, { start: index * size }));
		})
	);
	// fse.rmdirSync(chunkDir);
}


async function pipeStream(path, writeStream) {
	new Promise(resolve => {
		const readStream = fse.createReadStream(path);
		readStream.on('end', () => {
			fse.unlinkSync(path);
			resolve();
		});
		readStream.pipe(writeStream);
	})
}
