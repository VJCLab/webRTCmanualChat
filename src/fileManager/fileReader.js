class FileReaderUtil {
    /**
     * File을 ArrayBuffer로 읽기
     * @param {Blob} chunk 파일 청크
     * @returns {Promise<ArrayBuffer>}
     */
    static readFileAsArrayBuffer(chunk) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(chunk);
        });
    }
}

export default FileReaderUtil;