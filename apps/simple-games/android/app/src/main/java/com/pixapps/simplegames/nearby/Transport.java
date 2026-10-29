package com.pixapps.simplegames.nearby;

interface Transport {
    interface Events {
        void peer(String id, String name, String listing);
        void peerLost(String id);
        void connected();
        default void connected(String peerId) { connected(); }
        void data(String data);
        default void data(String peerId, String data) { data(data); }
        void status(String message);
        void failed(String code, String message);
        void disconnected(String reason);
        default void disconnected(String peerId, String reason) { disconnected(reason); }
    }
    void start(boolean advertise, String label, byte[] listing) throws Exception;
    void connect(String peerId) throws Exception;
    void send(byte[] frame) throws Exception;
    default void send(byte[] frame, String peerId) throws Exception {
        if (peerId != null) throw new IllegalArgumentException("This transport does not support targeted sends");
        send(frame);
    }
    default void disconnect(String peerId) throws Exception {
        throw new IllegalArgumentException("This transport does not support targeted disconnects");
    }
    default void setListingVisible(boolean visible) throws Exception {
        throw new IllegalArgumentException("This transport does not support listing visibility");
    }
    default void drainAndStop(Runnable completed) { stop(); completed.run(); }
    void setForeground(boolean active);
    void stop();
}
