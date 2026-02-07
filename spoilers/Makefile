# A Traveler's Guide to the Mazes of Menace -- Build System
#
# Usage:
#   make html    -- Build standalone HTML version
#   make pdf     -- Build B-format (129x198mm) PDF for print
#   make all     -- Build both
#   make clean   -- Remove build artifacts

GUIDE = guide.md
HTML  = guide.html
PDF   = guide.pdf

PANDOC = pandoc

# Common pandoc flags
COMMON_FLAGS = --standalone --toc --toc-depth=3

# HTML-specific flags
HTML_FLAGS = $(COMMON_FLAGS) \
	--css=style.css \
	--self-contained \
	--metadata title="A Traveler's Guide to the Mazes of Menace" \
	--template=html-template.html \
	-t html5

# PDF-specific flags (XeLaTeX for system font support)
PDF_FLAGS = $(COMMON_FLAGS) \
	--pdf-engine=xelatex \
	--include-in-header=header.tex \
	--include-before-body=frontmatter.tex \
	-V documentclass=book \
	-V fontsize=9pt \
	-V mainfont="Linux Libertine O" \
	-V monofont="DejaVu Sans Mono" \
	-V linestretch=1.15 \
	-V colorlinks=true

.PHONY: all html pdf clean

all: html pdf

html: $(HTML)

pdf: $(PDF)

$(HTML): $(GUIDE) style.css html-template.html
	$(PANDOC) $(HTML_FLAGS) -o $@ $<

$(PDF): $(GUIDE) header.tex frontmatter.tex
	$(PANDOC) $(PDF_FLAGS) -o $@ $<

clean:
	rm -f $(HTML) $(PDF) *.aux *.log *.toc *.out
