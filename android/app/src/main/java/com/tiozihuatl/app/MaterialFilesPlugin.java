package com.tiozihuatl.app;

import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.*;
import java.util.concurrent.*;

/** Descargas por streaming, sin pasar videos/base64 por el bridge ni permisos amplios de almacenamiento. */
@CapacitorPlugin(name = "MaterialFiles")
public class MaterialFilesPlugin extends Plugin {
    private final ExecutorService worker = Executors.newFixedThreadPool(2);
    private final Map<String, Transfer> transfers = new ConcurrentHashMap<>();
    private final Map<String, String> saved = new ConcurrentHashMap<>();
    private static final long MAX_BYTES = 100L * 1024 * 1024; // Límite real de subida.
    private static class Transfer { volatile boolean cancelled; volatile HttpURLConnection connection; }
    private HttpURLConnection connect(String url, boolean probe, Transfer transfer) throws Exception {
        for (int redirects = 0; redirects <= 5; redirects++) {
            if (transfer.cancelled) throw new IOException("Descarga cancelada.");
            if (!MaterialFileInfo.safeUrl(url)) throw new IOException("Dirección del archivo no válida.");
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            transfer.connection = c;
            c.setConnectTimeout(30000); c.setReadTimeout(45000); c.setInstanceFollowRedirects(false);
            c.setRequestProperty("Accept-Encoding", "identity");
            if (probe) c.setRequestProperty("Range", "bytes=0-511");
            // Cloudinary público no recibe tokens institucionales.
            int status = c.getResponseCode();
            if (status >= 300 && status < 400) {
                String location = c.getHeaderField("Location");
                c.disconnect();
                if (location == null) throw new IOException("Archivo no disponible.");
                url = new URL(new URL(url), location).toString(); continue;
            }
            if (status != 200 && !(probe && status == 206)) {
                c.disconnect();
                throw new IOException(status == 404 ? "El archivo ya no está disponible." : status == 401 || status == 403 ? "No tienes autorización para obtener este archivo." : "No fue posible obtener el archivo. Revisa tu conexión e intenta nuevamente.");
            }
            return c;
        }
        throw new IOException("El archivo redirige demasiadas veces.");
    }
    private byte[] prefix(InputStream stream) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] buf = new byte[512];
        while (out.size() < 512) { int count = stream.read(buf, 0, 512 - out.size()); if (count < 0) break; out.write(buf, 0, count); }
        return out.toByteArray();
    }
    @PluginMethod public void probe(PluginCall call) {
        worker.execute(() -> {
            Transfer transfer = new Transfer();
            try {
                HttpURLConnection c = connect(call.getString("url", ""), true, transfer);
                try (InputStream in = c.getInputStream()) {
                    MaterialFileInfo info = MaterialFileInfo.inspect(prefix(in), c.getContentType(), call.getString("kind", ""), c.getURL().toString(), call.getString("title", "material"), c.getHeaderField("Content-Disposition"));
                    JSObject result = new JSObject(); result.put("name", info.name); result.put("mime", info.mime); call.resolve(result);
                }
            } catch (Exception e) { call.reject(message(e)); }
            finally { if (transfer.connection != null) transfer.connection.disconnect(); }
        });
    }
    @PluginMethod public void download(PluginCall call) {
        String id = call.getString("requestId", "");
        Transfer transfer = new Transfer();
        if (id.isEmpty() || transfers.putIfAbsent(id, transfer) != null) { call.reject("La descarga ya está en curso."); return; }
        worker.execute(() -> {
            Uri uri = null; File file = null; boolean completed = false;
            try {
                HttpURLConnection c = connect(call.getString("url", ""), false, transfer);
                long expected = c.getContentLengthLong();
                if (expected > MAX_BYTES) throw new IOException("El archivo supera el límite de 100 MB del sistema.");
                try (InputStream in = c.getInputStream()) {
                    byte[] head = prefix(in);
                    MaterialFileInfo info = MaterialFileInfo.inspect(head, c.getContentType(), call.getString("kind", ""), c.getURL().toString(), call.getString("title", "material"), c.getHeaderField("Content-Disposition"));
                    String location;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.MediaColumns.DISPLAY_NAME, info.name); values.put(MediaStore.MediaColumns.MIME_TYPE, info.mime);
                        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Tiozihuatl");
                        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
                        uri = getContext().getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                        if (uri == null) throw new IOException("No fue posible crear el archivo descargado.");
                        location = "Descargas/Tiozihuatl/" + info.name;
                    } else {
                        File directory = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                        if (directory == null || (!directory.exists() && !directory.mkdirs())) throw new IOException("Almacenamiento no disponible.");
                        file = new File(directory, info.name); int n = 1;
                        while (file.exists()) { int dot = info.name.lastIndexOf('.'); file = new File(directory, info.name.substring(0, dot) + " (" + n++ + ")" + info.name.substring(dot)); }
                        uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
                        location = "Carpeta de descargas de la aplicación: " + file.getName() + ". Usa Abrir archivo para consultarlo.";
                    }
                    try (OutputStream out = getContext().getContentResolver().openOutputStream(uri)) {
                        if (out == null) throw new IOException("No fue posible guardar el archivo.");
                        long total = head.length; out.write(head); byte[] buffer = new byte[65536]; int count;
                        while ((count = in.read(buffer)) != -1) {
                            if (transfer.cancelled) throw new IOException("Descarga cancelada.");
                            total += count; if (total > MAX_BYTES) throw new IOException("El archivo supera el límite de 100 MB del sistema.");
                            out.write(buffer, 0, count);
                        }
                        if (transfer.cancelled || (expected >= 0 && total != expected)) throw new IOException("La descarga quedó incompleta. Intenta nuevamente.");
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ContentValues values = new ContentValues(); values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                        getContext().getContentResolver().update(uri, values, null, null);
                    }
                    String actualName = info.name;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        try (android.database.Cursor cursor = getContext().getContentResolver().query(uri, new String[]{MediaStore.MediaColumns.DISPLAY_NAME}, null, null, null)) {
                            if (cursor != null && cursor.moveToFirst()) actualName = cursor.getString(0);
                        }
                        location = "Descargas/Tiozihuatl/" + actualName;
                    } else actualName = file.getName();
                    saved.put(uri.toString(), info.mime); completed = true;
                    JSObject result = new JSObject(); result.put("uri", uri.toString()); result.put("name", actualName); result.put("mime", info.mime); result.put("location", location); call.resolve(result);
                }
            } catch (Exception e) { call.reject(message(e)); }
            finally {
                if (!completed) { if (file != null) file.delete(); else if (uri != null) try { getContext().getContentResolver().delete(uri, null, null); } catch (Exception ignored) {} }
                if (transfer.connection != null) transfer.connection.disconnect(); transfers.remove(id);
            }
        });
    }
    @PluginMethod public void cancel(PluginCall call) {
        Transfer transfer = transfers.get(call.getString("requestId", ""));
        if (transfer != null) { transfer.cancelled = true; if (transfer.connection != null) transfer.connection.disconnect(); }
        call.resolve();
    }
    @PluginMethod public void open(PluginCall call) {
        String uri = call.getString("uri", ""); String mime = saved.get(uri);
        if (mime == null) { call.reject("Descarga nuevamente el archivo antes de abrirlo."); return; }
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse(uri), mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                if (intent.resolveActivity(getContext().getPackageManager()) == null) { call.reject("No hay una aplicación compatible instalada para abrir este archivo."); return; }
                getActivity().startActivity(Intent.createChooser(intent, "Abrir material con")); call.resolve();
            } catch (Exception e) { call.reject("No hay una aplicación compatible instalada para abrir este archivo."); }
        });
    }
    private String message(Exception e) { return e instanceof IOException ? "No fue posible completar la operación. " + (e.getMessage() == null ? "Revisa tu conexión e intenta nuevamente." : e.getMessage()) : e.getMessage() == null ? "Archivo no disponible." : e.getMessage(); }
    @Override protected void handleOnDestroy() { transfers.values().forEach(t -> { t.cancelled = true; if (t.connection != null) t.connection.disconnect(); }); worker.shutdownNow(); }
}
