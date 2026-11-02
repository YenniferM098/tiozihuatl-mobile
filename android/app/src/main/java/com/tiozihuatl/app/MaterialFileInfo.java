package com.tiozihuatl.app;

import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Sin dependencias Android: valida los formatos admitidos por uploadMaterial.middleware. */
final class MaterialFileInfo {
    final String mime, name;
    MaterialFileInfo(String mime, String name) { this.mime = mime; this.name = name; }
    static boolean safeUrl(String value) {
        try {
            URL u = new URL(value);
            return "https".equals(u.getProtocol()) && "res.cloudinary.com".equals(u.getHost())
                && u.getUserInfo() == null && (u.getPort() == -1 || u.getPort() == 443)
                && u.getPath().matches(".*/(image|video|raw)/upload/.*");
        } catch (Exception e) { return false; }
    }
    private static boolean bytes(byte[] data, int offset, int... values) {
        if (data.length < offset + values.length) return false;
        for (int i = 0; i < values.length; i++) if ((data[offset + i] & 255) != values[i]) return false;
        return true;
    }
    private static boolean text(byte[] data, int offset, String text) {
        byte[] value = text.getBytes(StandardCharsets.US_ASCII);
        if (data.length < offset + value.length) return false;
        for (int i = 0; i < value.length; i++) if (data[offset + i] != value[i]) return false;
        return true;
    }
    static MaterialFileInfo inspect(byte[] head, String type, String kind, String url, String title, String disposition) throws Exception {
        String beginning = new String(head, StandardCharsets.UTF_8).trim().toLowerCase(Locale.ROOT);
        String contentType = type == null ? "" : type.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
        if (head.length == 0 || (contentType.matches(".*(html|json).*" ) || contentType.equals("application/xml") || contentType.equals("text/xml") || contentType.endsWith("+xml")) || beginning.matches("(?s)^(<!doctype|<html|<\\?xml|\\{|\\[).*"))
            throw new Exception("El servidor devolvió un error o una respuesta de autenticación, no un archivo.");
        String mime = "", ext = "", group = "";
        if (text(head, 0, "%PDF-")) { mime = "application/pdf"; ext = "pdf"; group = "PDF"; }
        else if (bytes(head, 0, 255, 216, 255)) { mime = "image/jpeg"; ext = "jpg"; group = "IMAGEN"; }
        else if (bytes(head, 0, 137, 80, 78, 71, 13, 10, 26, 10)) { mime = "image/png"; ext = "png"; group = "IMAGEN"; }
        else if (text(head, 0, "RIFF") && text(head, 8, "WEBP")) { mime = "image/webp"; ext = "webp"; group = "IMAGEN"; }
        else if (text(head, 4, "ftyp")) { ext = text(head, 8, "qt") ? "mov" : "mp4"; mime = ext.equals("mov") ? "video/quicktime" : "video/mp4"; group = "VIDEO"; }
        else if (bytes(head, 0, 26, 69, 223, 163)) { mime = "video/webm"; ext = "webm"; group = "VIDEO"; }
        else if (bytes(head, 0, 208, 207, 17, 224, 161, 177, 26, 225) && kind.matches("WORD|EXCEL|PPT")) {
            ext = kind.equals("WORD") ? "doc" : kind.equals("EXCEL") ? "xls" : "ppt";
            mime = kind.equals("WORD") ? "application/msword" : kind.equals("EXCEL") ? "application/vnd.ms-excel" : "application/vnd.ms-powerpoint"; group = kind;
        } else if (bytes(head, 0, 80, 75, 3, 4) || bytes(head, 0, 80, 75, 5, 6) || bytes(head, 0, 80, 75, 7, 8)) {
            if (kind.matches("WORD|EXCEL|PPT")) {
                ext = kind.equals("WORD") ? "docx" : kind.equals("EXCEL") ? "xlsx" : "pptx";
                mime = "application/vnd.openxmlformats-officedocument." + (kind.equals("WORD") ? "wordprocessingml.document" : kind.equals("EXCEL") ? "spreadsheetml.sheet" : "presentationml.presentation"); group = kind;
            } else { mime = "application/zip"; ext = "zip"; group = "ZIP"; }
        } else if (text(head, 0, "Rar!")) { mime = "application/vnd.rar"; ext = "rar"; group = "ZIP"; }
        else if (bytes(head, 0, 55, 122, 188, 175, 39, 28)) { mime = "application/x-7z-compressed"; ext = "7z"; group = "ZIP"; }
        if (mime.isEmpty() || (!group.equals(kind) && !kind.equals("OTRO"))) throw new Exception("El formato recibido no coincide con el material publicado.");
        String name = "";
        if (disposition != null) {
            Matcher encoded = Pattern.compile("filename\\*\\s*=\\s*UTF-8''([^;]+)", Pattern.CASE_INSENSITIVE).matcher(disposition);
            Matcher plain = Pattern.compile("filename\\s*=\\s*\"([^\"]+)\"|filename\\s*=\\s*([^;]+)", Pattern.CASE_INSENSITIVE).matcher(disposition);
            if (encoded.find()) name = URLDecoder.decode(encoded.group(1), "UTF-8");
            else if (plain.find()) name = plain.group(1) != null ? plain.group(1) : plain.group(2);
        }
        if (name.isEmpty()) {
            String path = new URL(url).getPath();
            name = URLDecoder.decode(path.substring(path.lastIndexOf('/') + 1).replace("+", "%2B"), "UTF-8");
        }
        name = cleanName(name);
        String lower = name.toLowerCase(Locale.ROOT);
        String actualExtension = ext.equals("jpg") && lower.endsWith(".jpeg") ? "jpeg" : ext;
        String base = stripExtensions(name);
        boolean generic = base.matches("(?i)^(archivo|file|documento?|material|recurso|download|descarga|imagen|image|video|untitled|sin[_ -]?t[ií]tulo)([_ -]*\\d+)?$");
        boolean identifier = base.matches("(?i)^(?:\\d+|[a-f0-9]{16,}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$");
        boolean opaque = base.matches("(?i)^[a-z0-9]{20,}$") && base.matches(".*\\d.*");
        if (base.isEmpty() || generic || identifier || opaque) base = stripExtensions(cleanName(title));
        if (base.isEmpty()) base = "material";
        if (base.length() > 170) base = base.substring(0, 170);
        return new MaterialFileInfo(mime, base + "." + actualExtension);
    }
    private static String cleanName(String name) {
        return name == null ? "" : name.replaceAll("[\\\\/\\x00-\\x1f:*?\"<>|]", "_").replaceAll("\\s+", " ").trim();
    }
    private static String stripExtensions(String name) {
        return name.replaceAll("(?i)(?:\\.(?:pdf|docx?|xlsx?|pptx?|png|jpe?g|webp|mp4|webm|mov|zip|rar|7z))+$", "");
    }
}
