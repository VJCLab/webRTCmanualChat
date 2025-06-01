import BitrateCalculator from './bitRateCalc.js';

class FileReceiver {
    constructor(emitter) {
        this.emitter = emitter;
        this.currentFileBuffer = [];
        this.currentFileMeta = null;
        this.receivedSize = 0;
        
        // 비트레이트 계산용 변수들
        this.receiveStartTime = 0;
        this.receiveLastTime = 0;
        this.receiveLastBytes = 0;
    }

    handleFileReceive(meta, e, progressCallback = () => {}, onReceiveEnd = () => {}, rsCB = () => {}) {
        if (!meta) {
            this.emitter.emit("systemMsg", "❌ 파일 메타데이터가 없습니다");
            return;
        }
        if (!e) {
            this.emitter.emit("systemMsg", "❌ 파일 데이터가 없습니다");
            return;
        }

        // 새 파일인지 확인 (메타데이터가 바뀌었거나 현재 파일이 없는 경우)
        const isNewFile = !this.currentFileMeta ||
            this.currentFileMeta.fileName !== meta.fileName ||
            this.currentFileMeta.fileIndex !== meta.fileIndex;

        // 새 파일 수신 시작 시 초기화
        if (isNewFile) {
            // 이전 파일이 완료되지 않았다면 경고
            if (this.currentFileBuffer.length > 0) {
                this.emitter.emit("systemMsg", `⚠️ 이전 파일 수신이 완료되지 않았습니다: ${this.currentFileMeta?.fileName}`);
            }

            // 새 파일을 위한 초기화
            this.currentFileBuffer = [];
            this.currentFileMeta = meta;
            this.receivedSize = 0;
            this.receiveStartTime = Date.now();
            this.receiveLastTime = this.receiveStartTime;
            this.receiveLastBytes = 0;

            this.emitter.emit("systemMsg", `📥 파일 수신 시작: ${meta.fileName} (${meta.fileIndex + 1}/${meta.totalFiles})`);
        }

        // 현재 파일 메타데이터 업데이트 (최신 정보 반영)
        this.currentFileMeta = meta;

        // 데이터 버퍼에 추가
        this.currentFileBuffer.push(e.data);
        this.receivedSize += e.data.byteLength;

        const currentFileMeta = this.currentFileMeta;
        const percent = currentFileMeta.fileSize > 0 ?
            Math.round((this.receivedSize / currentFileMeta.fileSize) * 100) : 100;

        // 비트레이트 계산
        const currentTime = Date.now();
        const avgBitrate = BitrateCalculator.calculateBitrate(this.receivedSize, this.receiveStartTime, currentTime);
        const instantBitrate = BitrateCalculator.calculateInstantBitrate(this.receivedSize, this.receiveLastBytes, currentTime, this.receiveLastTime);

        this.emitter.emit("fileReceiveProgress", {
            fileName: currentFileMeta.fileName,
            loaded: this.receivedSize,
            total: currentFileMeta.fileSize,
            percent: percent,
            currentFile: currentFileMeta.fileIndex + 1,
            totalFiles: currentFileMeta.totalFiles,
            avgBitrate: avgBitrate,
            instantBitrate: instantBitrate
        });

        // 비트레이트 계산용 이전 값 업데이트
        this.receiveLastTime = currentTime;
        this.receiveLastBytes = this.receivedSize;

        // 파일 완료 체크 (받은 크기가 예상 크기와 같거나 클 때)
        if (this.receivedSize >= currentFileMeta.fileSize) {
            const completeFile = new Blob(this.currentFileBuffer, { type: currentFileMeta.fileType });

            // 파일 수신 완료 이벤트 전달
            onReceiveEnd({
                type: "fileReceived",
                fileName: currentFileMeta.fileName,
                fileIndex: currentFileMeta.fileIndex,
                totalFiles: currentFileMeta.totalFiles,
                downloadUrl: URL.createObjectURL(completeFile),
                avgBitrate: avgBitrate
            })
         

            // 현재 파일 완료 후 상태 초기화
            this.currentFileBuffer = [];
            this.currentFileMeta = null;
            this.receivedSize = 0;

            if (currentFileMeta.fileIndex + 1 >= currentFileMeta.totalFiles) {
                this.emitter.emit("systemMsg", `🎉 모든 파일 수신 완료! (총 ${currentFileMeta.totalFiles}개)`);
                this.emitter.emit("allFilesReceived", { totalFiles: currentFileMeta.totalFiles });
            }
        }
    }
}

export default FileReceiver;