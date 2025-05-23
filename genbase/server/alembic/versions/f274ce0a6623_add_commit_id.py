"""add commit_id

Revision ID: f274ce0a6623
Revises: 05b6260d347c
Create Date: 2025-05-21 22:14:21.389548

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f274ce0a6623'
down_revision: Union[str, None] = '05b6260d347c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('chat_messages', sa.Column('commit_id', sa.String(), nullable=True))
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('chat_messages', 'commit_id')
    # ### end Alembic commands ###
