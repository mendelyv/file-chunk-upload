
<template>
  <div id="app">
		<div>
			<input type="file" @change="handleFileChange" />
			<el-button @click="handleUpload">上传</el-button>
			<el-button @click="handlePause">暂停</el-button>
		</div>
		<div>
			<div>进度：</div>
			<el-progress :percentage="uploadPercent"></el-progress>
		</div>
  </div>
</template>

<script>

import sparkMD5 from 'spark-md5';
const SIZE = 10 * 1024 * 1024;

export default {
  name: 'App',
	data: () => ({
		container: {
			file: null,
		},
		data: [],
		requestList: [],
	}),
	methods: {

		handleFileChange(e) {
			const [file] = e.target.files;
			if(!file) return;
			Object.assign(this.$data, this.$options.data());
			this.container.file = file;
		},

		createFileChunk(file, size = SIZE) {
			const fileChunkList = [];
			let cur = 0;
			while(cur < file.size) {
				fileChunkList.push({file: file.slice(cur, cur + size)});
				cur += size;
			}
			return fileChunkList;
		},

		async uploadChunks() {
			const requestList = this.data.map(({chunk, hash, index}) => {
				const formData = new FormData();
				formData.append('chunk', chunk);
				formData.append('hash', hash);
				formData.append('filename', this.container.file.name);
				formData.append('fileHash', this.container.hash);
				return {formData, index};
			}).map(({formData, index}) => {
				return this.request({
					url: "http://localhost:9339",
					data: formData,
					onProgress: this.createProgressHandle(this.data[index]),
					requestList: this.requestList,
				})
			});
			await Promise.all(requestList);
			await this.mergeRequest();
		},

		async handleUpload() {
			if(!this.container.file) return;
			const fileChunkList = this.createFileChunk(this.container.file);
			this.container.hash = await this.calculateHash(fileChunkList);
			const {exists} = await this.verifyFile(this.container.file.name, this.container.hash);
			if(exists) {
				console.log('文件已存在');
				return;
			}
			this.data = fileChunkList.map(({file}, index) => ({
				fileHash: this.container.hash,
				chunk: file,
				hash: this.container.hash + "-" + index,
				index: index,
				percent: 0,
				size: file.size,
			}));
			await this.uploadChunks();
		},

		async handlePause() {
			this.requestList.forEach(request => request.abort());
			this.requestList = [];
		},

		async mergeRequest() {
			await this.request({
				url: "http://localhost:9339/merge",
				headers: {
					'Content-Type': 'application/json',
				},
				data: JSON.stringify({
					fileHash: this.container.hash,
					filename: this.container.file.name,
					size: SIZE,
				})
			});
		},

		createProgressHandle(item) {
			return (e) => {
				item.percent = parseInt(String((e.loaded / e.total) * 100));
			}
		},

		// calculateHash(fileChunks) {
		// 	return new Promise((resolve, reject) => {
		// 		this.container.worker = new Worker('/hash.js');
		// 		this.container.worker.postMessage({fileChunks});
		// 		this.container.worker.onmessage = (e) => {
		// 			const hash = e.data.hash;
		// 			if(hash) { resolve(hash); }
		// 		}
		// 	})
		// },

		async calculateHash(fileChunks) {
			const spark = new sparkMD5.ArrayBuffer();
			let count = 0;
			let hash = 0;
			return new Promise((resolve, reject) => {
				const loadNext = function(index) {
					const reader = new FileReader();
					reader.readAsArrayBuffer(fileChunks[index].file);
					reader.onload = (e) => {
						count++;
						spark.append(e.target.result);
						if(count >= fileChunks.length) {
							hash = spark.end();
							resolve(hash);
						} else {
							loadNext(count);
						}
					}
				}
				loadNext(0);
			});
		},

		async verifyFile(filename, fileHash) {
			const {data} = await this.request({
				url: "http://localhost:9339/verify",
				data: JSON.stringify({
					filename,
					fileHash,
				}),
				headers: {
					'Content-Type': 'application/json',
				},
			});
			return JSON.parse(data);
		},

		request({url, method = "post", data, headers = {}, onProgress = () => {}, requestList}) {
			return new Promise((resolve, reject) => {
				const xhr = new XMLHttpRequest();
				xhr.upload.onprogress = onProgress;
				xhr.open(method, url);
				Object.keys(headers).forEach(key => {
					xhr.setRequestHeader(key, headers[key]);
				});
				xhr.send(data);
				xhr.onload = e => {
					if(requestList) {
						const xhrIdx = requestList.findIndex(req => req.xhr === xhr);
						requestList.splice(xhrIdx, 1);
					}
					resolve({
							data: e.target.response,
					})
				}
				if(requestList) requestList.push(xhr);
			});
		},



	},
	computed: {
		uploadPercent() {
			if(!this.container.file || this.data.length <= 0) return;

			const percent = this.data.map(item => item.size * item.percent).reduce((pre, cur) => pre + cur);
			return parseInt((percent / this.container.file.size).toFixed(2));
		}
	},




};

</script>
