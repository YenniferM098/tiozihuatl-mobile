package com.tiozihuatl.app;

import android.view.HapticFeedbackConstants;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Respuesta táctil del sistema (la misma de los botones de Android), no una vibración.
 * Usa performHapticFeedback, que respeta el ajuste "Respuesta táctil" del celular y su intensidad.
 */
@CapacitorPlugin(name = "TouchFeedback")
public class TouchFeedbackPlugin extends Plugin {

    @PluginMethod
    public void perform(PluginCall call) {
        String strength = call.getString("strength", "light");
        int feedback = "medium".equals(strength)
            ? HapticFeedbackConstants.VIRTUAL_KEY
            : HapticFeedbackConstants.KEYBOARD_TAP;

        getActivity().runOnUiThread(() -> {
            getBridge().getWebView().performHapticFeedback(feedback);
            call.resolve();
        });
    }
}
