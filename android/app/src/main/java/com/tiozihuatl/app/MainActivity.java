package com.tiozihuatl.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin propio: debe registrarse antes de que arranque el bridge.
        registerPlugin(TouchFeedbackPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
