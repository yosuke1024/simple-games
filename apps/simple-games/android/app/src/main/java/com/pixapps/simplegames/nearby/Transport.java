package com.pixapps.simplegames.nearby;

interface Transport {
    interface Events {
        void peer(String id, String name, String listing);
        void peerLost(String id);
        void connected();
        void data(String data);
        void status(String message);
        void failed(String code, String message);
        void disconnected(String reason);
    }
    void start(boolean advertise, String label, byte[] listing) throws Exception;
    void connect(String peerId) throws Exception;
    void send(byte[] frame) throws Exception;
    void setForeground(boolean active);
    void stop();
}
