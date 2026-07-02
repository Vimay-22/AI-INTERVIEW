import jsPDF from 'jspdf';
import type { FinalInterviewSummary, QuestionReport } from '@/services/resumeInterviewApi';

interface PDFReportData {
  candidateName: string;
  date: string;
  interviewType: string;
  summary: FinalInterviewSummary;
  questionsAndAnswers: Array<{
    question: string;
    answer: string;
    category: string;
  }>;
}

export function generateInterviewReportPDF(data: PDFReportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Helper function to add new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Helper function to wrap text
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return lines.length * (fontSize * 0.5); // Return height used
  };

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Interview Performance Report', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Candidate Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Candidate: ${data.candidateName}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Date: ${data.date}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Interview Type: ${data.interviewType}`, margin, yPosition);
  yPosition += 15;

  // Overall Score Section
  doc.setFillColor(59, 130, 246); // Blue background
  doc.rect(margin, yPosition, contentWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Overall Score', pageWidth / 2, yPosition + 10, { align: 'center' });
  doc.setFontSize(24);
  doc.text(`${data.summary.overallScore}/10`, pageWidth / 2, yPosition + 22, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  yPosition += 40;

  // Score Details
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Points Earned: ${data.summary.totalPoints?.toFixed(1)} / ${data.summary.maxPoints}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Questions Answered: ${data.questionsAndAnswers.length}`, margin, yPosition);
  yPosition += 15;

  // Performance Breakdown
  if (data.summary.performanceBreakdown) {
    checkPageBreak(40);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Performance Breakdown', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const breakdown = data.summary.performanceBreakdown;
    doc.text(`Excellent (8-10): ${breakdown.excellent}`, margin, yPosition);
    doc.text(`Good (6-7): ${breakdown.good}`, margin + 60, yPosition);
    yPosition += 7;
    doc.text(`Fair (4-5): ${breakdown.fair}`, margin, yPosition);
    doc.text(`Poor (0-3): ${breakdown.poor}`, margin + 60, yPosition);
    yPosition += 15;
  }

  // Average Scores
  if (data.summary.averageScores) {
    checkPageBreak(30);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Average Scores', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const avg = data.summary.averageScores;
    doc.text(`Technical: ${avg.technical}/10`, margin, yPosition);
    doc.text(`Clarity: ${avg.clarity}/10`, margin + 60, yPosition);
    doc.text(`Confidence: ${avg.confidence}/10`, margin + 120, yPosition);
    yPosition += 15;
  }

  // Question-by-Question Analysis
  doc.addPage();
  yPosition = margin;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Question-by-Question Analysis', margin, yPosition);
  yPosition += 15;

  console.log('📄 PDF Generation - Questions:', data.questionsAndAnswers.length);
  console.log('📄 PDF Generation - Reports:', data.summary.questionReports?.length);

  if (!data.questionsAndAnswers || data.questionsAndAnswers.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('No questions answered yet.', margin, yPosition);
  } else {
    data.questionsAndAnswers.forEach((qa, index) => {
      const report = data.summary.questionReports?.[index];
      
      console.log(`📄 Processing Question ${index + 1}:`, {
        hasQuestion: !!qa.question,
        hasAnswer: !!qa.answer,
        hasReport: !!report
      });

      checkPageBreak(80);

      // Question header with score
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPosition, contentWidth, 10, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Question ${index + 1}`, margin + 2, yPosition + 7);
      
      if (report) {
        doc.text(`${report.overallScore}/10`, pageWidth - margin - 20, yPosition + 7);
      }
      yPosition += 15;

      // Question text
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Question:', margin, yPosition);
      yPosition += 5;
      doc.setFont('helvetica', 'normal');
      const qHeight = addWrappedText(qa.question || 'No question text', margin + 5, yPosition, contentWidth - 5, 10);
      yPosition += qHeight + 7;

      checkPageBreak(30);

      // Your answer
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235); // Blue
      doc.text('Your Answer:', margin, yPosition);
      yPosition += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      const aHeight = addWrappedText(qa.answer || 'No answer provided', margin + 5, yPosition, contentWidth - 5, 9);
      yPosition += aHeight + 7;

      if (report) {
        checkPageBreak(30);

        // Scores
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`Scores: Technical ${report.technicalScore}/10  |  Clarity ${report.clarityScore}/10  |  Confidence ${report.confidenceScore}/10  |  Points Earned: ${report.points}`, margin, yPosition);
        yPosition += 7;

        // Performance badge
        doc.setFontSize(10);
        const perfColor = report.overallScore >= 8 ? [34, 197, 94] : 
                         report.overallScore >= 6 ? [59, 130, 246] :
                         report.overallScore >= 4 ? [251, 146, 60] : [239, 68, 68];
        doc.setTextColor(perfColor[0], perfColor[1], perfColor[2]);
        doc.text(`Performance: ${report.performance}`, margin, yPosition);
        doc.setTextColor(0, 0, 0);
        yPosition += 10;

        checkPageBreak(20);

        // Feedback
        doc.setFont('helvetica', 'bold');
        doc.text('AI Feedback:', margin, yPosition);
        yPosition += 5;
        doc.setFont('helvetica', 'normal');
        const fHeight = addWrappedText(report.feedback || 'No feedback available', margin + 5, yPosition, contentWidth - 5, 9);
        yPosition += fHeight + 7;

        checkPageBreak(20);

        // Improved Answer Tip
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(34, 197, 94); // Green
        doc.text('Improved Answer (What You Should Say):', margin, yPosition);
        yPosition += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const itHeight = addWrappedText(report.improvedAnswerTip || 'No improvement tip available', margin + 5, yPosition, contentWidth - 5, 9);
        yPosition += itHeight + 7;

        // Mistakes
        if (report.mistakes && report.mistakes.length > 0) {
          checkPageBreak(20);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(220, 38, 38); // Red
          doc.text('Mistakes Found:', margin, yPosition);
          yPosition += 5;
          doc.setFont('helvetica', 'normal');
          report.mistakes.forEach(mistake => {
            checkPageBreak(10);
            const mHeight = addWrappedText(`• ${mistake}`, margin + 5, yPosition, contentWidth - 5, 8);
            yPosition += mHeight + 3;
          });
          doc.setTextColor(0, 0, 0);
          yPosition += 5;
        }

        // Missing Points
        if (report.missingPoints && report.missingPoints.length > 0) {
          checkPageBreak(20);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(234, 88, 12); // Orange
          doc.text('Missing Key Points:', margin, yPosition);
          yPosition += 5;
          doc.setFont('helvetica', 'normal');
          report.missingPoints.forEach(point => {
            checkPageBreak(10);
            const mpHeight = addWrappedText(`• ${point}`, margin + 5, yPosition, contentWidth - 5, 8);
            yPosition += mpHeight + 3;
          });
          doc.setTextColor(0, 0, 0);
          yPosition += 5;
        }
      } else {
        // No report available
        doc.setFontSize(9);
        doc.setTextColor(128, 128, 128);
        doc.text('(Evaluation not available for this question)', margin, yPosition);
        doc.setTextColor(0, 0, 0);
        yPosition += 7;
      }

      // Add separator line
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;
    });
  }

  // Summary Page
  doc.addPage();
  yPosition = margin;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary & Recommendations', margin, yPosition);
  yPosition += 15;

  // Strong Areas
  if (data.summary.strongAreas.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74); // Green
    doc.text('Strong Areas', margin, yPosition);
    yPosition += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    data.summary.strongAreas.forEach(area => {
      checkPageBreak(10);
      const height = addWrappedText(`✓ ${area}`, margin + 5, yPosition, contentWidth - 5, 10);
      yPosition += height + 3;
    });
    doc.setTextColor(0, 0, 0);
    yPosition += 10;
  }

  // Weak Areas
  if (data.summary.weakAreas.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38); // Red
    doc.text('Areas for Improvement', margin, yPosition);
    yPosition += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    data.summary.weakAreas.forEach(area => {
      checkPageBreak(10);
      const height = addWrappedText(`✗ ${area}`, margin + 5, yPosition, contentWidth - 5, 10);
      yPosition += height + 3;
    });
    doc.setTextColor(0, 0, 0);
    yPosition += 10;
  }

  // Suggested Improvements
  if (data.summary.suggestedImprovements.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235); // Blue
    doc.text('Suggested Improvements', margin, yPosition);
    yPosition += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    data.summary.suggestedImprovements.forEach(improvement => {
      checkPageBreak(10);
      const height = addWrappedText(`• ${improvement}`, margin + 5, yPosition, contentWidth - 5, 10);
      yPosition += height + 3;
    });
    doc.setTextColor(0, 0, 0);
    yPosition += 10;
  }

  // Closing Remark
  checkPageBreak(30);
  doc.setFillColor(59, 130, 246);
  doc.rect(margin, yPosition, contentWidth, 25, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const remarkLines = doc.splitTextToSize(data.summary.closingRemark, contentWidth - 10);
  doc.text(remarkLines, pageWidth / 2, yPosition + 8, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128, 128, 128);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text('Generated by AI Interview Coach', pageWidth / 2, pageHeight - 5, { align: 'center' });
  }

  // Save the PDF
  const fileName = `Interview_Report_${data.candidateName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
