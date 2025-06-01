import { ChunkSize, FILE_CONFIRMATION_TOUT } from './cfg.js';
import BufferMgr from './bufferMgr.js';
import BitrateCalculator from './bitRateCalc.js';
import FileReaderUtil from './fileReader.js';

class FileSender {
    constructor(fileChannel, metaManager, emitter) {
        this.fileChannel = fileChannel;
        this.metaManager = metaManager;
        this.emitter = emitter;
        this.chunkSize = ChunkSize;
        
        // 비트레이트 계산용 변수들
        this.sendStartTime = 0;
        this.sendLastTime = 0;
        this.sendLastBytes = 0;
    }

    /**
     * 단일 파일 전송 (버퍼 관리 포함)
     * @param {File} file 전송할 파일
     * @param {number} fileIndex 파일 인덱스
     * @param {number} totalFiles 총 파일 수
     * @param {?Function} progressCallback 진행상황 콜백
     */
    async sendSingleFile(file, fileIndex, totalFiles, progressCallback = () => {}) {
        this.emitter.emit("systemMsg", `📤 파일 전송 중: ${file.name} (${fileIndex + 1}/${totalFiles})`);

        // 파일 메타데이터 준비 및 전송
        const meta = {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            lastModified: file.lastModified,
            fileIndex: fileIndex,
            totalFiles: totalFiles
        };

        // 메타데이터 전송
        this.metaManager.send(meta);

        // 빈 파일 처리
        if (file.size === 0) {
            this.emitter.emit("systemMsg", `⚠️ 빈 파일: ${file.name}`);
            progressCallback({
                currentFile: fileIndex + 1,
                totalFiles: totalFiles,
                fileName: file.name,
                loaded: 0,
                total: 0,
                percent: 100,
                avgBitrate: 0,
                instantBitrate: 0
            });
            return;
        }

        // 비트레이트 계산용 초기화
        this.sendStartTime = Date.now();
        this.sendLastTime = this.sendStartTime;
        this.sendLastBytes = 0;

        let offset = 0;
        const totalSize = file.size;

        while (offset < totalSize) {
            const chunkEnd = Math.min(offset + this.chunkSize, totalSize);
            const chunk = file.slice(offset, chunkEnd);

            // ArrayBuffer로 변환
            const arrayBuffer = await FileReaderUtil.readFileAsArrayBuffer(chunk);

            // 안전한 전송 (버퍼 관리 포함)
            await BufferMgr.safeSend(this.fileChannel, arrayBuffer);

            offset = chunkEnd;

            // 비트레이트 계산
            const currentTime = Date.now();
            const avgBitrate = BitrateCalculator.calculateBitrate(offset, this.sendStartTime, currentTime);
            const instantBitrate = BitrateCalculator.calculateInstantBitrate(offset, this.sendLastBytes, currentTime, this.sendLastTime);

            // 진행상황 콜백
            const percent = Math.round((offset / totalSize) * 100);
            progressCallback({
                currentFile: fileIndex + 1,
                totalFiles: totalFiles,
                fileName: file.name,
                loaded: offset,
                total: totalSize,
                percent: percent,
                avgBitrate: avgBitrate,
                instantBitrate: instantBitrate
            });

            this.emitter.emit("fileProgress", {
                fileName: file.name,
                loaded: offset,
                total: totalSize,
                percent: percent,
                avgBitrate: avgBitrate,
                instantBitrate: instantBitrate
            });

            // 비트레이트 계산용 이전 값 업데이트
            this.sendLastTime = currentTime;
            this.sendLastBytes = offset;
        }

        this.emitter.emit("systemMsg", `✅ 파일 전송 완료: ${file.name}`);
    }

    /**
     * Send multiple files with buffer management
     * @param {FileList|File[]} files input file list
     * @param {Function} progressCallback progress callback
     * @param {Function} rsCB file list reset callback
     */
    async sendFiles(files, progressCallback = () => {}, rsCB = () => {}) {
        if (!this.fileChannel || !files || this.fileChannel.readyState !== "open") {
            this.emitter.emit("systemMsg", "❌ 파일 채널이 준비되지 않았습니다");
            return;
        }

        const fileArray = Array.from(files);
        if (fileArray.length === 0) {
            this.emitter.emit("systemMsg", "❌ 전송할 파일이 없습니다");
            rsCB();
            return;
        }

        this.emitter.emit("systemMsg", `📤 ${fileArray.length}개 파일 전송 시작`);

        try {
            for (let currentFileIndex = 0; currentFileIndex < fileArray.length; currentFileIndex++) {
                const file = fileArray[currentFileIndex];
                await this.sendSingleFile(file, currentFileIndex, fileArray.length, progressCallback);

                // 모든 파일 수신 확인 대기 (마지막 파일이 아닌 경우)
                await this.waitForFileReceived(file.name, currentFileIndex);
            }

            this.emitter.emit("systemMsg", "✅ 모든 파일 전송 완료");
            this.emitter.emit("fileTransferComplete", { totalFiles: fileArray.length });
            rsCB();
        } catch (error) {
            this.emitter.emit("systemMsg", `❌ 파일 전송 오류: ${error.message}`);
            this.emitter.emit("fileTransferError", { error });
            rsCB();
        }
    }

    // 수신 확인 대기 메서드
    waitForFileReceived(fileName, fileIndex) {
        const confirmationPromise = new Promise((resolve) => {
            const checkConfirmation = (meta) => {
                if (meta.fileName === fileName && meta.fileIndex === fileIndex) {
                    this.emitter.emit("systemMsg", `📋 수신 확인됨: ${fileName}`);
                    resolve();
                } else {
                    this.emitter.once("fileReceivedConfirmation", checkConfirmation);
                }
            };

            this.emitter.once("fileReceivedConfirmation", checkConfirmation);
        });

        const tPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`파일 수신 확인 타임아웃: ${fileName}`));
            }, FILE_CONFIRMATION_TOUT);
        });

        return Promise.race([confirmationPromise, tPromise]);
    }
}

export default FileSender;