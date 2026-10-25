import { jsPDF } from 'jspdf';
import { MonthlyLetter } from '../types';

export function createPdfDocument(
  monthlyLetter: MonthlyLetter,
  userName: string = 'Friend',
  goal: string = 'Financial Reserve'
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const month = monthlyLetter.month || 'Monthly';
  const year = monthlyLetter.year || 2026;

  // Background dark theme
  doc.setFillColor(15, 15, 18);
  doc.rect(0, 0, 210, 297, 'F');

  // Header line
  doc.setDrawColor(44, 44, 46);
  doc.setLineWidth(0.5);
  doc.line(15, 25, 195, 25);

  // Title & Header Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.text('Kova Monthly Briefing', 15, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(138, 138, 142);
  doc.text(`${month} ${year}  ·  Personal Financial Literacy Report`, 15, 22);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(userName, 195, 18, { align: 'right' });
  
  doc.setTextColor(138, 138, 142);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(goal, 195, 22, { align: 'right' });

  // Headline
  doc.setTextColor(255, 255, 255);
  doc.setFont('times', 'italic');
  doc.setFontSize(13);
  const headlineLines = doc.splitTextToSize(`"${monthlyLetter.headline || 'Monthly Financial Reflection'}"`, 180);
  doc.text(headlineLines, 15, 34);

  let currentY = 34 + (headlineLines.length * 6) + 4;

  // Card 1: Three Key Observations
  doc.setFillColor(24, 24, 26);
  doc.setDrawColor(44, 44, 46);
  doc.roundedRect(15, currentY, 180, 68, 3, 3, 'FD');

  doc.setTextColor(138, 138, 142);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('THREE KEY OBSERVATIONS', 22, currentY + 9);

  let obsY = currentY + 18;
  const observations = monthlyLetter.observations || [];
  observations.forEach((obs, idx) => {
    doc.setTextColor(138, 138, 142);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`0${idx + 1}`, 22, obsY);

    doc.setTextColor(229, 229, 231);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const obsLines = doc.splitTextToSize(obs, 156);
    doc.text(obsLines, 30, obsY);
    obsY += (obsLines.length * 4.8) + 4;
  });

  currentY = currentY + 75;

  // Card 2: Suggested Shift & Wealth Mindset
  doc.setFillColor(24, 24, 26);
  doc.roundedRect(15, currentY, 180, 38, 3, 3, 'FD');

  doc.setTextColor(138, 138, 142);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('SUGGESTED SHIFT & WEALTH PRINCIPLE', 22, currentY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(229, 229, 231);
  const shiftLines = doc.splitTextToSize(monthlyLetter.suggestedShift || 'Focus on building sustainable capital allocation habits.', 166);
  doc.text(shiftLines, 22, currentY + 18);

  currentY = currentY + 45;

  // Card 3: Recommended Reading
  doc.setFillColor(24, 24, 26);
  doc.roundedRect(15, currentY, 180, 48, 3, 3, 'FD');

  doc.setTextColor(138, 138, 142);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('RECOMMENDED LITERACY READING', 22, currentY + 9);

  const book = monthlyLetter.bookRecommendation || {
    title: 'The Psychology of Money',
    author: 'Morgan Housel',
    rationale: 'Timeless lessons on wealth, greed, and happiness.',
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(book.title, 22, currentY + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(138, 138, 142);
  doc.text(`by ${book.author}`, 22, currentY + 23);

  doc.setFontSize(8.8);
  doc.setTextColor(204, 204, 204);
  const rationaleLines = doc.splitTextToSize(book.rationale, 166);
  doc.text(rationaleLines, 22, currentY + 31);

  // Footer
  doc.setDrawColor(44, 44, 46);
  doc.line(15, 275, 195, 275);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(138, 138, 142);
  doc.text('Generated with quiet intention by Kova  ·  Private & Confidential', 105, 282, { align: 'center' });

  return doc;
}

export async function downloadMonthlyReportPdf(
  monthlyLetter: MonthlyLetter,
  userName: string = 'Friend',
  goal: string = 'Financial Reserve'
): Promise<void> {
  const doc = createPdfDocument(monthlyLetter, userName, goal);
  const monthName = monthlyLetter?.month || 'Monthly';
  const fileName = `Kova-${monthName}-Report.pdf`;

  // If mobile platform and navigator.share is available, share the file blob directly
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const blob = doc.output('blob');
      const file = new File([blob], fileName, {
        type: 'application/pdf',
      });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Kova Monthly Reflection - ${monthName}`,
        });
        return;
      }
    } catch (shareErr: any) {
      // If user dismissed the share sheet, exit gracefully
      if (shareErr.name === 'AbortError') return;
      console.warn('Web Share failed, falling back to direct save:', shareErr);
    }
  }

  // Default web fallback
  doc.save(fileName);
}
