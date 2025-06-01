/** 
 * @typedef {Object} FileInfo
 * @prop {String} fileName
 * @prop {Number} fileSize
 * @prop {String} fileType
 * @prop {Number} lastModified
 * @prop {Number} fileIndex
 * @prop {Number} totalFiles
 */

class FileMETA {
    constructor(Fmanager) {
        this.Fmanager = Fmanager;
    }
    Fmanager = null;
    metaPrefix = "__META__";
    /** @type {?FileInfo} */
    decodedMeta = null;
    // 파일별 메타데이터 저장
    #fileMetaCache = new Map();
    MSGCHANNEL = null;
    listen(channel, nonMetaHandler = () => { }) {
        this.MSGCHANNEL = channel;
        channel.addEventListener("message", msgEv => {
            if (this.checkISMeta(msgEv.data)) {
                this.handleRecevedFileMeta.call(this, msgEv.data);
                return;
            }
            nonMetaHandler(msgEv);
        });
    }
    handleRecevedFileMeta(string) {
        const meta = this.decode(string);

        // 수신 확인 메시지인 경우
        if (meta.type === "fileReceived") {
            this.Fmanager?.emitter.emit("fileReceivedConfirmation", meta);
            return meta;
        }

        this.decodedMeta = meta;

        // 파일별 메타데이터 캐싱
        const fileKey = `${meta.fileIndex}_${meta.fileName}`;
        this.#fileMetaCache.set(fileKey, meta);

        return meta;
    }
    encode(string) {
        const metaString = this.metaPrefix + JSON.stringify(string);
        return metaString;
    }
    /**
     * decode file metaString to File info Object
     * @param {String} string 
     * @returns {FileInfo}
     */
    decode(string) {
        string = string.slice(this.metaPrefix.length);
        return JSON.parse(string);
    }
    checkISMeta(string) {
        return string.startsWith(this.metaPrefix);
    }
    /**
     * send file meta to receiver 
     * @param {FileInfo} meta
     */
    send(meta) {
        this.MSGCHANNEL.send(this.encode(meta));
    }
}
export default FileMETA;