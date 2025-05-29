package com.example;

import com.intellij.openapi.actionSystem.AnAction;
import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.actionSystem.CommonDataKeys;
import com.intellij.openapi.editor.Editor;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.ui.Messages;
import com.intellij.openapi.vfs.VirtualFile;
import com.intellij.psi.PsiFile;
import org.jetbrains.annotations.NotNull;
import org.json.JSONObject;

/**
 * This is a simple example of an IntelliJ IDEA plugin action that uses our
 * Node.js core functionality through the CLI tool.
 */
public class CodeAnalyzerAction extends AnAction {

    @Override
    public void actionPerformed(@NotNull AnActionEvent e) {
        final Project project = e.getRequiredData(CommonDataKeys.PROJECT);
        final PsiFile psiFile = e.getData(CommonDataKeys.PSI_FILE);
        final VirtualFile virtualFile = e.getData(CommonDataKeys.VIRTUAL_FILE);

        if (psiFile == null || virtualFile == null) {
            Messages.showErrorDialog(project, "Cannot analyze file: No file selected", "Analysis Failed");
            return;
        }

        try {
            // Get the file path
            String filePath = virtualFile.getPath();

            // Get CliServiceManager instance
            CliServiceManager serviceManager = CliServiceManager.getInstance(project);
            
            // Analyze file using the service
            JSONObject analysisResult = serviceManager.analyzeFile(filePath);
            
            // Show the analysis results in our custom dialog
            new AnalysisResultsDialog(project, analysisResult.toString()).show();
            
        } catch (Exception ex) {
            Messages.showErrorDialog(project,
                    "Error analyzing file: " + ex.getMessage(),
                    "Analysis Failed");
        }
    }

    @Override
    public void update(@NotNull AnActionEvent e) {
        // Enable the action only if a project and editor are available
        Project project = e.getProject();
        Editor editor = e.getData(CommonDataKeys.EDITOR);
        e.getPresentation().setEnabledAndVisible(project != null && editor != null);
    }
}