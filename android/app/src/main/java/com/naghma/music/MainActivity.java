package com.naghma.music;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Playback is selected in the UI; allow the subsequent React effect to start it.
        bridge.getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
    }
}
