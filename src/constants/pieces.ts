import whiteKing from '@/assets/pieces/white-king.svg'
import whiteQueen from '@/assets/pieces/white-queen.svg'
import whiteRook from '@/assets/pieces/white-rook.svg'
import whiteBishop from '@/assets/pieces/white-bishop.svg'
import whiteKnight from '@/assets/pieces/white-knight.svg'
import whitePawn from '@/assets/pieces/white-pawn.svg'
import blackKing from '@/assets/pieces/black-king.svg'
import blackQueen from '@/assets/pieces/black-queen.svg'
import blackRook from '@/assets/pieces/black-rook.svg'
import blackBishop from '@/assets/pieces/black-bishop.svg'
import blackKnight from '@/assets/pieces/black-knight.svg'
import blackPawn from '@/assets/pieces/black-pawn.svg'

export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p'
export type PromotionPiece = Exclude<PieceType, 'k' | 'p'>

export const PIECE_IMAGES: Record<'w' | 'b', Record<PieceType, string>> = {
  w: {
    k: whiteKing,
    q: whiteQueen,
    r: whiteRook,
    b: whiteBishop,
    n: whiteKnight,
    p: whitePawn,
  },
  b: {
    k: blackKing,
    q: blackQueen,
    r: blackRook,
    b: blackBishop,
    n: blackKnight,
    p: blackPawn,
  },
}

export const PIECE_LABELS: Record<PieceType, string> = {
  k: '國王',
  q: '皇后',
  r: '城堡',
  b: '主教',
  n: '騎士',
  p: '士兵',
}

export const PROMOTION_ORDER: PromotionPiece[] = ['q', 'r', 'b', 'n']
