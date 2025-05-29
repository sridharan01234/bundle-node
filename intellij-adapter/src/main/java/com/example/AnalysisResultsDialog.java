package com.example;

import com.intellij.openapi.project.Project;
import com.intellij.openapi.ui.DialogWrapper;
import com.intellij.util.ui.JBUI;
import org.jetbrains.annotations.Nullable;
import org.json.JSONArray;
import org.json.JSONObject;

import javax.swing.*;
import javax.swing.text.html.HTMLEditorKit;
import javax.swing.text.html.StyleSheet;
import java.awt.*;

/**
 * Dialog to display analysis results in IntelliJ
 */
public class AnalysisResultsDialog extends DialogWrapper {
    private final String resultsJson;

    public AnalysisResultsDialog(@Nullable Project project, String resultsJson) {
        super(project);
        this.resultsJson = resultsJson;
        setTitle("Code Analysis Results");
        setSize(600, 400);
        init();
    }

    @Override
    protected @Nullable JComponent createCenterPanel() {
        JPanel panel = new JPanel(new BorderLayout());
        panel.setPreferredSize(new Dimension(600, 400));
        panel.setBorder(JBUI.Borders.empty(10));

        // Create results pane with HTML rendering
        JEditorPane resultsPane = new JEditorPane();
        resultsPane.setEditable(false);
        resultsPane.setContentType("text/html");
        
        // Set up HTML styling
        HTMLEditorKit kit = new HTMLEditorKit();
        StyleSheet styleSheet = kit.getStyleSheet();
        styleSheet.addRule("body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; }");
        styleSheet.addRule(".header { background-color: #f0f0f0; padding: 10px; border-bottom: 1px solid #ccc; }");
        styleSheet.addRule(".error { color: #e53e3e; }");
        styleSheet.addRule(".suggestion { color: #dd6b20; }");
        styleSheet.addRule(".no-issues { color: #38a169; text-align: center; margin-top: 50px; }");
        styleSheet.addRule(".issue-container { border: 1px solid #eee; margin-bottom: 10px; }");
        styleSheet.addRule(".issue-header { font-weight: bold; background-color: #f7f7f7; padding: 5px; }");
        styleSheet.addRule(".issue-item { padding: 8px; border-bottom: 1px solid #eee; }");
        resultsPane.setEditorKit(kit);

        // Parse JSON and generate HTML
        try {
            JSONObject results = new JSONObject(resultsJson);
            String fileName = results.optString("fileName", "Unknown file");
            int lineCount = results.optInt("lineCount", 0);
            
            JSONArray errors = results.optJSONArray("errors") != null ? 
                               results.getJSONArray("errors") : new JSONArray();
            
            JSONArray suggestions = results.optJSONArray("suggestions") != null ? 
                                    results.getJSONArray("suggestions") : new JSONArray();

            int totalIssues = errors.length() + suggestions.length();

            StringBuilder html = new StringBuilder();
            html.append("<html><body>");
            html.append("<div class='header'>");
            html.append("<h2>Analysis Results</h2>");
            html.append("<div><strong>File:</strong> ").append(fileName).append("</div>");
            html.append("<div><strong>Line count:</strong> ").append(lineCount).append("</div>");
            html.append("<div><strong>Issues found:</strong> ").append(totalIssues).append("</div>");
            html.append("</div>");

            // Display errors if any
            if (errors.length() > 0) {
                html.append("<h3>").append(errors.length()).append(" Errors</h3>");
                html.append("<div class='issue-container'>");
                for (int i = 0; i < errors.length(); i++) {
                    html.append("<div class='issue-item error'>").append(errors.getString(i)).append("</div>");
                }
                html.append("</div>");
            }

            // Display suggestions if any
            if (suggestions.length() > 0) {
                html.append("<h3>").append(suggestions.length()).append(" Suggestions</h3>");
                html.append("<div class='issue-container'>");
                for (int i = 0; i < suggestions.length(); i++) {
                    html.append("<div class='issue-item suggestion'>").append(suggestions.getString(i)).append("</div>");
                }
                html.append("</div>");
            }

            // No issues found
            if (totalIssues == 0) {
                html.append("<div class='no-issues'>");
                html.append("<h3>✓ No issues found</h3>");
                html.append("<p>Your code looks good!</p>");
                html.append("</div>");
            }

            html.append("</body></html>");
            resultsPane.setText(html.toString());

        } catch (Exception e) {
            // If JSON parsing fails, just show the raw JSON
            resultsPane.setText("<html><body><pre>" + resultsJson + "</pre></body></html>");
        }

        JScrollPane scrollPane = new JScrollPane(resultsPane);
        panel.add(scrollPane, BorderLayout.CENTER);
        return panel;
    }

    @Override
    protected Action[] createActions() {
        return new Action[]{getOKAction()};
    }
}