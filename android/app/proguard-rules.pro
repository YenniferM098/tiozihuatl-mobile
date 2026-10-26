# Reglas de R8 para Tiozihuatl Mobile.
# Capacitor y sus plugins ya incluyen sus propias reglas (consumer rules) que conservan
# las clases con @CapacitorPlugin y los métodos @PluginMethod que se llaman desde JavaScript.

# Plugin propio de respuesta táctil: se registra por clase en MainActivity.
-keep class com.tiozihuatl.app.TouchFeedbackPlugin { *; }

# Métodos expuestos al WebView.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Conserva número de línea para leer los errores en Play Console con mapping.txt,
# pero oculta el nombre real de los archivos fuente.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
