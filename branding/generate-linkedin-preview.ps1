Add-Type -AssemblyName System.Drawing

$outPath = Join-Path $PSScriptRoot 'solvyard-linkedin-product-preview.png'
$size = 1200
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$navy = [System.Drawing.ColorTranslator]::FromHtml('#0F1626')
$inkSoft = [System.Drawing.ColorTranslator]::FromHtml('#1A2338')
$paper = [System.Drawing.ColorTranslator]::FromHtml('#EEF0E6')
$muted = [System.Drawing.ColorTranslator]::FromHtml('#9AA1B5')
$amber = [System.Drawing.ColorTranslator]::FromHtml('#FFB020')
$mint = [System.Drawing.ColorTranslator]::FromHtml('#3DDC97')
$coral = [System.Drawing.ColorTranslator]::FromHtml('#FF6B4A')
$white = [System.Drawing.Color]::White

function Font([float]$size, [bool]$bold = $false) {
  $style = if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
  return New-Object System.Drawing.Font('Segoe UI', $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}
function Mono([float]$size, [bool]$bold = $false) {
  $style = if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
  return New-Object System.Drawing.Font('Consolas', $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}
function Brush($color) { New-Object System.Drawing.SolidBrush $color }
function Pen($color, [float]$width = 1.0) { New-Object System.Drawing.Pen $color, $width }
function Text([string]$text, $font, $color, [float]$x, [float]$y) { $g.DrawString($text, $font, (Brush $color), $x, $y) }
function RoundRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x,$y,$d,$d,180,90); $p.AddArc($x+$w-$d,$y,$d,$d,270,90)
  $p.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90); $p.AddArc($x,$y+$h-$d,$d,$d,90,90)
  $p.CloseFigure(); return $p
}
function Card([float]$x,[float]$y,[float]$w,[float]$h,$accent) {
  $path = RoundRect $x $y $w $h 14
  $g.FillPath((Brush $inkSoft),$path); $g.DrawPath((Pen $accent 2),$path); $path.Dispose()
}

$g.Clear($navy)

# Blueprint grid and framing
$gridPen = Pen ([System.Drawing.Color]::FromArgb(18,238,240,230)) 1
for($i=0; $i -le 1200; $i+=30) { $g.DrawLine($gridPen,$i,0,$i,1200); $g.DrawLine($gridPen,0,$i,1200,$i) }
$framePen = Pen $amber 3
$g.DrawLine($framePen,48,92,48,48); $g.DrawLine($framePen,48,48,126,48)
$g.DrawLine($framePen,1074,48,1152,48); $g.DrawLine($framePen,1152,48,1152,92)
$g.DrawLine($framePen,48,1108,48,1152); $g.DrawLine($framePen,48,1152,126,1152)
$g.DrawLine($framePen,1074,1152,1152,1152); $g.DrawLine($framePen,1152,1108,1152,1152)

# Header
Text 'solv' (Font 34 $true) $paper 74 82
Text 'yard' (Font 34 $true) $coral 145 82
Text 'PRODUCT PREVIEW / 01' (Mono 12 $true) $muted 906 88
$g.DrawLine((Pen ([System.Drawing.Color]::FromArgb(90,238,240,230)) 1),74,130,1126,130)

# Headline
Text 'A better path from' (Font 46 $true) $paper 74 166
Text 'problem' (Font 46 $true) $amber 74 218
Text 'to proof.' (Font 46 $true) $paper 265 218
Text 'A working product loop for people with problems and the startups that solve them.' (Font 17) $muted 76 282

# Construction circle
$circlePen = Pen ([System.Drawing.Color]::FromArgb(160,255,176,32)) 2
$g.DrawEllipse($circlePen,206,274,788,788)

# Browser app shell
$shell = RoundRect 124 350 952 576 18
$g.FillPath((Brush ([System.Drawing.Color]::FromArgb(246,26,35,56))),$shell); $g.DrawPath((Pen ([System.Drawing.Color]::FromArgb(120,238,240,230)) 1.5),$shell); $shell.Dispose()
$g.FillRectangle((Brush ([System.Drawing.Color]::FromArgb(255,15,22,38))),125,351,950,52)
$g.FillEllipse((Brush $coral),150,370,10,10); $g.FillEllipse((Brush $amber),168,370,10,10); $g.FillEllipse((Brush $mint),186,370,10,10)
Text 'solvyard.app / matching live' (Mono 12) $muted 224 367

# UI title
Text 'Someone might already be solving your' (Font 28 $true) $paper 166 435
Text 'problem.' (Font 28 $true) $amber 736 435
Text 'Describe it naturally. We will look for the startup built to solve it.' (Font 15) $muted 168 477

# Problem input
Card 166 525 400 204 $amber
Text '01  /  YOUR PROBLEM' (Mono 12 $true) $amber 192 552
$g.DrawLine((Pen ([System.Drawing.Color]::FromArgb(55,255,176,32)) 1),192,578,540,578)
Text 'Rent splitting always' (Font 22 $true) $paper 192 602
Text 'causes a fight' (Font 22 $true) $paper 192 632
Text 'Shared living - posted just now' (Font 13) $muted 192 680
$vote = RoundRect 192 696 116 24 7; $g.FillPath((Brush ([System.Drawing.Color]::FromArgb(35,255,176,32))),$vote); $vote.Dispose()
Text '+ 41 waiting' (Mono 11 $true) $amber 205 700

# Match connector
$dash = Pen $muted 2; $dash.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
$g.DrawLine($dash,566,627,634,627)
$g.FillEllipse((Brush $navy),586,596,56,56); $g.DrawEllipse((Pen $mint 2),586,596,56,56)
Text 'MATCH' (Mono 8 $true) $mint 596 613; Text '92%' (Mono 13 $true) $paper 598 626
$g.DrawLine($dash,642,627,666,627)

# Startup match
Card 666 525 356 204 $mint
$startupLabel = "02 - STARTUP MATCH"
Text $startupLabel (Mono 12 $true) $mint 692 552
$g.DrawLine((Pen ([System.Drawing.Color]::FromArgb(55,61,220,151)) 1),692,578,996,578)
Text 'SplitFair' (Font 24 $true) $paper 692 602
$sharedText = "Shared expenses without"
$dramaText = "the spreadsheet drama"
Text -text $sharedText -font (Font 16) -color $muted -x 692 -y 637
Text -text $dramaText -font (Font 16) -color $muted -x 692 -y 660
$pill = RoundRect 692 690 172 30 8; $g.FillPath((Brush $mint),$pill); $pill.Dispose()
$viewText = "View solution"
Text -text $viewText -font (Font 13 $true) -color $navy -x 708 -y 696

# Outcome bar
$outcome = RoundRect 166 760 856 108 14
$g.FillPath((Brush ([System.Drawing.Color]::FromArgb(255,15,22,38))),$outcome); $g.DrawPath((Pen ([System.Drawing.Color]::FromArgb(100,238,240,230)) 1),$outcome); $outcome.Dispose()
$g.FillEllipse((Brush $mint),194,792,32,32)
Text 'OK' (Mono 11 $true) $navy 199 800
$outcomeLabel = "03 - VERIFIED OUTCOME"
Text $outcomeLabel (Mono 11 $true) $mint 246 781
$solvedText = "It actually solved it"
$reviewText = "Reviews come from people who had the problem"
Text -text $solvedText -font (Font 19 $true) -color $paper -x 246 -y 802
Text -text $reviewText -font (Font 13) -color $muted -x 246 -y 832
Text '5 / 5' (Mono 19 $true) $amber 890 804

# annotations around shell
$annPen = Pen $amber 1.5; $annPen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
$g.DrawLine($annPen,96,497,166,525); $g.DrawLine($annPen,96,497,96,468)
Text 'INPUT IN PLAIN LANGUAGE' (Mono 10 $true) $amber 72 442
$mintPen = Pen $mint 1.5; $mintPen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
$g.DrawLine($mintPen,1022,525,1108,480); $g.DrawLine($mintPen,1108,450,1108,480)
Text 'MATCH, NOT SEARCH' (Mono 10 $true) $mint 922 424
$coralPen = Pen $coral 1.5; $coralPen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
$g.DrawLine($coralPen,874,869,1050,964); $g.DrawLine($coralPen,1050,964,1110,964)
Text 'PROOF FROM REAL USERS' (Mono 10 $true) $coral 840 980

# footer launch statement
$g.DrawLine((Pen ([System.Drawing.Color]::FromArgb(90,238,240,230)) 1),74,1046,1126,1046)
Text 'REAL PROBLEMS. STARTUP MATCHES. VERIFIED OUTCOMES.' (Mono 16 $true) $paper 74 1080
Text 'solvyard - problems in, products out' (Font 14) $muted 74 1116
Text 'LINKEDIN LAUNCH PREVIEW' (Mono 11 $true) $amber 906 1117

$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output $outPath
