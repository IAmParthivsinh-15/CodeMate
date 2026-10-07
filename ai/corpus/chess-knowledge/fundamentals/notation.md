---
title: Chess Notation
topic: fundamentals
subcategory: notation
difficulty: beginner
tags: [notation, algebraic notation, pgn, move symbols, how to read moves]
---

# Chess Notation

## Definition
Chess notation is the system used to write down moves so that games can be recorded, replayed and studied. The standard today is algebraic notation. Each square has a name made of a file letter and a rank number. Files run from a to h, left to right from White's side of the board. Ranks run from 1 to 8, starting at White's side. So White's king starts on e1, Black's king on e8, and the square in White's bottom-left corner is a1. Every square has exactly one name, which never changes regardless of whose point of view you take. Game files in the PGN format use this same algebraic notation.

## Writing piece moves
In algebraic chess notation each piece has a capital letter: K for king, Q for queen, R for rook, B for bishop and N for knight (N because K is already taken). Pawns have no letter. A move is written as the piece letter followed by the destination square: `Nf3` means a knight moves to f3, `e4` means a pawn moves to e4. A capture adds an x: `Bxc6` means a bishop captures on c6, and a pawn capture names the file the pawn came from, as in `exd5`. When two identical pieces could reach the same square, add the starting file or rank to tell them apart: `Nbd2` (the knight from the b-file) or `R1e2` (the rook from the first rank).

## Special symbols
Chess notation uses a few extra symbols:
- `+` means check and `#` means checkmate, for example `Qxf7#`.
- `O-O` is kingside castling and `O-O-O` is queenside castling.
- `=` shows promotion: `e8=Q` means a pawn reaches e8 and becomes a queen.
- `e.p.` is sometimes added to an en passant capture.
- Moves are numbered in pairs: `1.e4 e5 2.Nf3 Nc6` means White played e4, Black e5, then White Nf3 and Black Nc6. When a line starts with a Black move it is written with dots, as in `2...Nc6`.
Commentators also use evaluation marks: `!` good move, `!!` brilliant move, `?` mistake, `??` blunder, `!?` interesting move and `?!` dubious move.

## How to spot it in your games
Learning notation well makes it much easier to review your own games and follow coaching advice. Practise by writing every move of your games, or by reading a short game and playing it out on a real board. Common beginner confusions to watch for:
- Mixing up files and ranks: the letter always comes first (`g5`, never `5g`).
- Reading the board from Black's side: square names do not change, so a8 is always the far-left corner as seen from White's side, even when you play Black.
- Forgetting to note captures and checks, which makes a game hard to replay later.
- Forgetting disambiguation, so it is unclear which knight or rook moved.
If you can read `1.e4 e5 2.Nf3 Nc6 3.Bb5` and picture the position without a board, your notation skills are solid.
