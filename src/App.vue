
<template>
  <div id="app">
		<div>
			<input type="file" @change="handleFileChange" />
			<el-button @click="handleUpload">上传</el-button>
		</div>
  </div>
</template>

<script>

const SIZE = 10 * 1024 * 1024;

export default {
  name: 'App',
	data: () => ({
		container: {
			file: null,
		},
		data: []
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
			const requestList = this.data.map(({chunk, hash}) => {
				const formData = new FormData();
				formData.append('chunk', chunk);
				formData.append('hash', hash);
				formData.append('filename', this.container.file.name);
				return {formData};
			}).map(({formData}) => {
				return this.request({
					url: "http://localhost:9339",
					data: formData,
				})
			});
			await Promise.all(requestList);
			await this.mergeRequest();
		},

		async handleUpload() {
			if(!this.container.file) return;
			const fileChunkList = this.createFileChunk(this.container.file);
			this.data = fileChunkList.map(({file}, index) => ({
				chunk: file,
				hash: this.container.file.name + "-" + index,
			}));
			await this.uploadChunks();
		},

		async mergeRequest() {
			await this.request({
				url: "http://localhost:9339/merge",
				headers: {
					'Content-Type': 'application/json',
				},
				data: JSON.stringify({
					filename: this.container.file.name,
					size: SIZE,
				})
			});
		},

		request({url, method = "post", data, headers = {}}) {
			return new Promise((resolve, reject) => {
				const xhr = new XMLHttpRequest();
				xhr.open(method, url);
				Object.keys(headers).forEach(key => {
					xhr.setRequestHeader(key, headers[key]);
				});
				xhr.send(data);
				xhr.onload = e => {
					resolve({
							data: e.target.response,
					})
				}
			});
		},



	},




};

</script>
