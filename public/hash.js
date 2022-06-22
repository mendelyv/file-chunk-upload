// web-worker
self.importScripts('/spark-md5.min.js');

self.onmessage = function (e) {
	const fileChunks = e.data.fileChunks;
	const spark = new self.SparkMD5.ArrayBuffer();
	// let percent = 0;
	let count = 0;
	const loadNext = function(index) {
		const reader = new FileReader();
		reader.readAsArrayBuffer(fileChunks[index].file);
		reader.onload = (e) => {
			count++;
			spark.append(e.target.result);
			if(count >= fileChunks.length) {
				self.postMessage({
					// percent: 100,
					hash: spark.end(),
				});
			} else {
				percent += 100 / fileChunks.length;
				self.postMessage({
					// percent: percent,
				});
				loadNext(count);
			}
		}
	}
	loadNext(0);
};
