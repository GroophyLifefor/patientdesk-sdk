// A scripted WebSocket implementation for unit tests. Records everything the
// client sends so tests can prove framing and auth without a real service.

export class FakeWebSocket {
  static instances = [];

  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    this.readyState = 0;
    this.sent = [];
    this.closed = null;
    this.binaryType = "blob";
    FakeWebSocket.instances.push(this);
  }

  send(data) {
    this.sent.push(data);
  }

  close(code = 1000, reason = "") {
    this.readyState = 3;
    this.closed = { code, reason };
    this.onclose?.({ code, reason });
  }

  // ---- test helpers ----
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }

  message(obj) {
    this.onmessage?.({ data: typeof obj === "string" ? obj : JSON.stringify(obj) });
  }

  binary(bytes) {
    const data = new Uint8Array(bytes);
    this.onmessage?.({ data: data.buffer });
  }

  /** Send a typed-array *view* (not a plain ArrayBuffer), for the defensive branch. */
  binaryView(bytes) {
    const data = new Uint8Array(bytes);
    this.onmessage?.({ data: data.subarray(0) });
  }

  serverClose(code = 1000, reason = "") {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}
