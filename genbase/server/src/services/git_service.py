"""
Native Git service with worktree support for concurrent operations
"""
import os
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, TypedDict
from git import Repo, InvalidGitRepositoryError, GitCommandError
from pydantic import BaseModel, Field

from ..logger import logger
from .project_service import ProjectService


class CommitResult(BaseModel):
    """Result of a Git commit operation"""
    success: bool = Field(description="Whether the commit operation succeeded")
    message: str = Field(description="Human-readable message about the operation")
    commit_id: Optional[str] = Field(None, description="Full commit hash if successful")
    commit_message: Optional[str] = Field(None, description="The message used for the commit")
    branch: Optional[str] = Field(None, description="Branch where the commit was made")
    commit_date: Optional[str] = Field(None, description="ISO formatted date of the commit")
    error: Optional[str] = Field(None, description="Error message if operation failed")
    no_changes: bool = Field(False, description="Whether there were no changes to commit")

    class Config:
        # Allow extra fields that aren't in our model
        extra = "allow"


        

class GitService:
    """
    Native Git service with integrated worktree support
    
    This service automatically creates worktrees for all branches except main,
    which uses the infrastructure directory directly. All operations are
    designed to work transparently with worktrees.
    """
    
    WORKTREES_DIR = ".worktrees"
    MAIN_BRANCH = "main"
    
    @staticmethod
    def init_repository(project_id: str) -> Dict[str, Any]:
        """Initialize a Git repository for a project with worktree support"""
        try:
            project_path = ProjectService.get_project_path(project_id)
            infra_path = project_path / "infrastructure"
            
            # Check if already a git repository
            if GitService._is_git_repository(project_path):
                repo = Repo(project_path)
                
                # Ensure infrastructure directory exists for main branch
                if not infra_path.exists():
                    infra_path.mkdir(parents=True, exist_ok=True)
                
                return {
                    "success": True,
                    "message": "Repository already initialized",
                    "already_exists": True,
                    "main_path": str(infra_path)
                }
            
            # Initialize repository at project root (not in infrastructure)
            repo = Repo.init(project_path)
            
            # Create .gitignore at project root
            gitignore_path = project_path / ".gitignore"
            if not gitignore_path.exists():
                gitignore_content = """# Terraform files
.terraform/
*.tfstate
*.tfstate.backup
*.tfplan


# Worktrees
.worktrees/
.worktrees/**


# Logs
*.log

"""
                with open(gitignore_path, 'w') as f:
                    f.write(gitignore_content)
            
            # Create project structure
            infra_path.mkdir(parents=True, exist_ok=True)
            modules_path = project_path / "modules"
            modules_path.mkdir(parents=True, exist_ok=True)
            
            # Create initial files in infrastructure
            main_tf = infra_path / "main.tf"
            if not main_tf.exists():
                with open(main_tf, "w") as f:
                    f.write('# Genbase project main configuration\n\n')
            
            tfvars_file = infra_path / "terraform.tfvars.json"
            if not tfvars_file.exists():
                with open(tfvars_file, "w") as f:
                    f.write('{\n}\n')
            
            # Initial commit (this creates the main branch)
            repo.git.add(A=True)
            repo.index.commit("Initial commit")
            
            # Ensure we're on main branch
            current_branch = repo.active_branch.name
            if current_branch != GitService.MAIN_BRANCH:
                repo.git.branch('-m', current_branch, GitService.MAIN_BRANCH)
            
            logger.info(f"Git repository initialized for project: {project_id}")
            
            return {
                "success": True,
                "message": "Repository initialized successfully",
                "already_exists": False,
                "main_path": str(infra_path)
            }
            
        except Exception as e:
            logger.error(f"Error initializing Git repository: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    def _is_git_repository(path: Path) -> bool:
        """Check if directory is a Git repository"""
        try:
            Repo(path)
            return True
        except InvalidGitRepositoryError:
            return False
    
    @staticmethod
    def get_repository(project_id: str) -> Optional[Repo]:
        """Get Git repository object for a project"""
        try:
            project_path = ProjectService.get_project_path(project_id)
            return Repo(project_path)
        except InvalidGitRepositoryError:
            return None
    
    @staticmethod
    def _get_worktrees_base_path(project_id: str) -> Path:
        """Get the base path for worktrees"""
        project_path = ProjectService.get_project_path(project_id)
        return project_path / GitService.WORKTREES_DIR
    
    @staticmethod
    def _generate_worktree_name(branch_name: str) -> str:
        """Generate a worktree directory name from branch name"""
        # Convert branch name to safe directory name
        # user/default/1 -> user_default_1
        return branch_name.replace("/", "_").replace("\\", "_").replace(" ", "_")
    
    @staticmethod
    def get_infrastructure_path(project_id: str, branch: str = MAIN_BRANCH) -> Path:
        """
        Get infrastructure path for any branch
        
        For main branch: returns project/infrastructure
        For other branches: returns project/.worktrees/{branch}/infrastructure
        """
        if branch == GitService.MAIN_BRANCH:
            # Main branch uses the standard infrastructure directory
            project_path = ProjectService.get_project_path(project_id)
            return project_path / "infrastructure"
        else:
            # Other branches use worktree infrastructure
            worktree_name = GitService._generate_worktree_name(branch)
            worktrees_base = GitService._get_worktrees_base_path(project_id)
            return worktrees_base / worktree_name / "infrastructure"
    
    @staticmethod
    def get_modules_path(project_id: str, branch: str = MAIN_BRANCH) -> Path:
        """
        Get modules path for any branch
        
        For main branch: returns project/modules
        For other branches: returns project/.worktrees/{branch}/modules
        """
        if branch == GitService.MAIN_BRANCH:
            # Main branch uses the standard modules directory
            project_path = ProjectService.get_project_path(project_id)
            return project_path / "modules"
        else:
            # Other branches use worktree modules
            worktree_name = GitService._generate_worktree_name(branch)
            worktrees_base = GitService._get_worktrees_base_path(project_id)
            return worktrees_base / worktree_name / "modules"
    
    @staticmethod
    def get_worktree_root_path(project_id: str, branch: str) -> Optional[Path]:
        """
        Get the root path of a worktree for a branch
        
        For main branch: returns project root
        For other branches: returns worktree root
        """
        if branch == GitService.MAIN_BRANCH:
            return ProjectService.get_project_path(project_id)
        else:
            worktree_name = GitService._generate_worktree_name(branch)
            worktrees_base = GitService._get_worktrees_base_path(project_id)
            worktree_path = worktrees_base / worktree_name
            return worktree_path if worktree_path.exists() else None
    
    @staticmethod
    def create_branch_with_worktree(project_id: str, branch_name: str) -> Dict[str, Any]:
        """
        Create a branch and its corresponding worktree atomically
        
        For main branch: no worktree needed
        For other branches: create both branch and worktree
        """
        try:
            repo = GitService.get_repository(project_id)
            if not repo:
                return {
                    "success": False,
                    "error": f"Project {project_id} is not a Git repository"
                }
            
            # Check if branch already exists
            if branch_name in [branch.name for branch in repo.branches]:
                # Check if worktree exists for non-main branches
                if branch_name != GitService.MAIN_BRANCH:
                    worktree_path = GitService.get_worktree_root_path(project_id, branch_name)
                    if not worktree_path:
                        # Branch exists but no worktree, create it
                        return GitService._create_worktree_for_existing_branch(project_id, branch_name)
                
                return {
                    "success": True,
                    "message": f"Branch '{branch_name}' already exists",
                    "already_exists": True,
                    "infrastructure_path": str(GitService.get_infrastructure_path(project_id, branch_name))
                }
            
            # Create branch from main
            main_branch = repo.heads[GitService.MAIN_BRANCH]
            new_branch = repo.create_head(branch_name, main_branch)
            
            # For main branch, no worktree needed
            if branch_name == GitService.MAIN_BRANCH:
                return {
                    "success": True,
                    "message": f"Branch '{branch_name}' created successfully",
                    "already_exists": False,
                    "infrastructure_path": str(GitService.get_infrastructure_path(project_id, branch_name))
                }
            
            # For other branches, create worktree
            try:
                worktree_result = GitService._create_worktree_for_branch(project_id, branch_name)
                if not worktree_result.get("success", False):
                    # Rollback branch creation
                    repo.delete_head(branch_name, force=True)
                    return {
                        "success": False,
                        "error": f"Failed to create worktree: {worktree_result.get('error', 'Unknown error')}"
                    }
                
                logger.info(f"Created branch '{branch_name}' with worktree for project {project_id}")
                
                return {
                    "success": True,
                    "message": f"Branch '{branch_name}' and worktree created successfully",
                    "already_exists": False,
                    "infrastructure_path": str(GitService.get_infrastructure_path(project_id, branch_name)),
                    "worktree_path": str(GitService.get_worktree_root_path(project_id, branch_name))
                }
                
            except Exception as e:
                # Rollback branch creation on worktree failure
                try:
                    repo.delete_head(branch_name, force=True)
                except:
                    pass
                raise e
                
        except GitCommandError as e:
            logger.error(f"Git error creating branch: {str(e)}")
            return {
                "success": False,
                "error": f"Git command failed: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Error creating branch {branch_name}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    def _create_worktree_for_branch(project_id: str, branch_name: str) -> Dict[str, Any]:
        """Create worktree for an existing branch"""
        try:
            repo = GitService.get_repository(project_id)
            if not repo:
                return {
                    "success": False,
                    "error": f"Project {project_id} is not a Git repository"
                }
            
            # Generate worktree path
            worktree_name = GitService._generate_worktree_name(branch_name)
            worktree_path = GitService._get_worktrees_base_path(project_id) / worktree_name
            
            # Ensure worktrees directory exists
            worktree_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Create worktree
            repo.git.worktree('add', str(worktree_path), branch_name)
            
            return {
                "success": True,
                "worktree_path": str(worktree_path)
            }
            
        except GitCommandError as e:
            return {
                "success": False,
                "error": f"Git worktree command failed: {str(e)}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    def _create_worktree_for_existing_branch(project_id: str, branch_name: str) -> Dict[str, Any]:
        """Create worktree for a branch that already exists"""
        worktree_result = GitService._create_worktree_for_branch(project_id, branch_name)
        
        if worktree_result.get("success", False):
            return {
                "success": True,
                "message": f"Worktree created for existing branch '{branch_name}'",
                "already_exists": False,
                "infrastructure_path": str(GitService.get_infrastructure_path(project_id, branch_name)),
                "worktree_path": worktree_result.get("worktree_path")
            }
        else:
            return {
                "success": False,
                "error": f"Failed to create worktree for existing branch: {worktree_result.get('error', 'Unknown error')}"
            }
    
    @staticmethod
    def delete_branch_with_worktree(project_id: str, branch_name: str) -> Dict[str, Any]:
        """
        Delete a branch and its corresponding worktree atomically
        
        For main branch: cannot delete
        For other branches: remove both worktree and branch
        """
        try:
            repo = GitService.get_repository(project_id)
            if not repo:
                return {
                    "success": False,
                    "error": f"Project {project_id} is not a Git repository"
                }
            
            # Cannot delete main branch
            if branch_name == GitService.MAIN_BRANCH:
                return {
                    "success": False,
                    "error": "Cannot delete main branch"
                }
            
            # Check if branch exists
            if branch_name not in [branch.name for branch in repo.branches]:
                return {
                    "success": True,
                    "message": f"Branch '{branch_name}' does not exist",
                    "already_deleted": True
                }
            
            # Remove worktree first (if it exists)
            worktree_path = GitService.get_worktree_root_path(project_id, branch_name)
            if worktree_path and worktree_path.exists():
                try:
                    repo.git.worktree('remove', str(worktree_path), '--force')
                    logger.info(f"Removed worktree for branch '{branch_name}'")
                except GitCommandError as e:
                    logger.warning(f"Could not remove worktree via git: {str(e)}, trying manual cleanup")
                    # Fallback: manual cleanup
                    try:
                        shutil.rmtree(worktree_path)
                    except Exception as cleanup_error:
                        logger.error(f"Failed to cleanup worktree directory: {str(cleanup_error)}")
            
            # Delete branch
            try:
                repo.delete_head(branch_name, force=True)
                logger.info(f"Deleted branch '{branch_name}'")
            except GitCommandError as e:
                return {
                    "success": False,
                    "error": f"Failed to delete branch: {str(e)}"
                }
            
            return {
                "success": True,
                "message": f"Branch '{branch_name}' and worktree deleted successfully",
                "already_deleted": False
            }
            
        except Exception as e:
            logger.error(f"Error deleting branch {branch_name}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    def list_chat_branches(project_id: str) -> List[Dict[str, Any]]:
        """List all chat branches (user/default/*) with metadata"""
        try:
            repo = GitService.get_repository(project_id)
            if not repo:
                return []
            
            chat_branches = []
            
            for branch in repo.branches:
                # Only include chat branches
                if branch.name.startswith("user/default/"):
                    try:
                        last_commit = branch.commit
                        
                        # Extract session number from branch name
                        session_number = int(branch.name.split("/")[-1])
                        
                        # Get infrastructure path for this branch
                        infra_path = GitService.get_infrastructure_path(project_id, branch.name)
                        
                        chat_branches.append({
                            "branch_name": branch.name,
                            "session_number": session_number,
                            "last_commit_date": last_commit.committed_datetime.isoformat(),
                            "last_commit_message": last_commit.message.strip(),
                            "infrastructure_path": str(infra_path),
                            "worktree_exists": infra_path.exists()
                        })
                    except Exception as e:
                        logger.warning(f"Error processing branch {branch.name}: {str(e)}")
            
            # Sort by session number
            chat_branches.sort(key=lambda x: x["session_number"], reverse=True)
            
            return chat_branches
            
        except Exception as e:
            logger.error(f"Error listing chat branches: {str(e)}")
            return []
    
    @staticmethod
    def list_all_branches(project_id: str) -> List[Dict[str, Any]]:
        """List all branches with their infrastructure paths"""
        try:
            repo = GitService.get_repository(project_id)
            if not repo:
                return []
            
            branches = []
            
            for branch in repo.branches:
                try:
                    last_commit = branch.commit
                    infra_path = GitService.get_infrastructure_path(project_id, branch.name)
                    
                    branches.append({
                        "branch_name": branch.name,
                        "is_main": branch.name == GitService.MAIN_BRANCH,
                        "last_commit_date": last_commit.committed_datetime.isoformat(),
                        "last_commit_message": last_commit.message.strip(),
                        "infrastructure_path": str(infra_path),
                        "path_exists": infra_path.exists()
                    })
                except Exception as e:
                    logger.warning(f"Error processing branch {branch.name}: {str(e)}")
            
            return branches
            
        except Exception as e:
            logger.error(f"Error listing branches: {str(e)}")
            return []
    
    @staticmethod
    def merge_branch(project_id: str, source_branch: str, target_branch: Optional[str] = None) -> Dict[str, Any]:
        """
        Merge source branch into target branch (defaults to main)
        """
        if target_branch is None:
            target_branch = GitService.MAIN_BRANCH
            
        try:
            repo = GitService.get_repository(project_id)
            if not repo:
                return {
                    "success": False,
                    "error": f"Project {project_id} is not a Git repository"
                }
            
            # Verify both branches exist
            if source_branch not in [branch.name for branch in repo.branches]:
                return {
                    "success": False,
                    "error": f"Source branch '{source_branch}' does not exist"
                }
            
            if target_branch not in [branch.name for branch in repo.branches]:
                return {
                    "success": False,
                    "error": f"Target branch '{target_branch}' does not exist"
                }
            
            # Get target worktree repository
            target_worktree_path = GitService.get_worktree_root_path(project_id, target_branch)
            if not target_worktree_path:
                return {
                    "success": False,
                    "error": f"Could not access worktree for target branch '{target_branch}'"
                }
            
            # Create a temporary repo object for the target worktree
            target_repo = Repo(target_worktree_path)
            
            # Perform merge in target worktree
            target_repo.git.merge(source_branch)
            
            logger.info(f"Merged branch '{source_branch}' into '{target_branch}'")
            
            return {
                "success": True,
                "message": f"Successfully merged '{source_branch}' into '{target_branch}'"
            }
            
        except GitCommandError as e:
            logger.error(f"Git error during merge: {str(e)}")
            return {
                "success": False,
                "error": f"Merge failed: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Error merging branches: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    def get_branch_diff(project_id: str, source_branch: str, target_branch: Optional[str] = None) -> Dict[str, Any]:
        """
        Get diff between two branches
        """
        if target_branch is None:
            target_branch = GitService.MAIN_BRANCH
            
        try:
            repo = GitService.get_repository(project_id)
            if not repo:
                return {
                    "success": False,
                    "error": f"Project {project_id} is not a Git repository"
                }
            
            # Verify both branches exist
            if source_branch not in [branch.name for branch in repo.branches]:
                return {
                    "success": False,
                    "error": f"Source branch '{source_branch}' does not exist"
                }
            
            if target_branch not in [branch.name for branch in repo.branches]:
                return {
                    "success": False,
                    "error": f"Target branch '{target_branch}' does not exist"
                }
            
            # Get diff
            diff_output = repo.git.diff(f"{target_branch}..{source_branch}")
            
            # Get list of changed files
            changed_files = repo.git.diff(f"{target_branch}..{source_branch}", name_only=True).splitlines()
            
            return {
                "success": True,
                "diff": diff_output,
                "changed_files": changed_files,
                "source_branch": source_branch,
                "target_branch": target_branch
            }
            
        except GitCommandError as e:
            logger.error(f"Git error getting diff: {str(e)}")
            return {
                "success": False,
                "error": f"Diff command failed: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Error getting branch diff: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }







    @staticmethod
    def commit_changes(project_id: str, branch: str, message: str, files: Optional[List[str]]=None) -> CommitResult: 
        """
        Commit changes to a branch in the repository
        
        Args:
            project_id: The project identifier
            branch: The branch name
            message: The commit message
            files: Optional list of specific files to commit (relative to infrastructure root)
                If not provided, all changes will be committed
            
        Returns:
            CommitResult with commit information
        """
        try:
            # Get repository
            repo = GitService.get_repository(project_id)
            if not repo:
                return CommitResult(
                    success=False,
                    error=f"Project {project_id} is not a Git repository",
                    message="Repository not found"
                )  # type: ignore
            
            # For non-main branch, we need to use the worktree
            if branch != GitService.MAIN_BRANCH:
                worktree_path = GitService.get_worktree_root_path(project_id, branch)
                if not worktree_path:
                    return CommitResult(
                        success=False,
                        error=f"Worktree not found for branch: {branch}",
                        message="Worktree not found"
                    ) # type: ignore
                
                # Create a repo object for the worktree
                worktree_repo = Repo(worktree_path)
            else:
                # Use the main repo
                worktree_repo = repo
            
            # Determine what to add
            if files is not None and len(files) > 0:
                # Add specific files (convert to absolute paths)
                infra_path = GitService.get_infrastructure_path(project_id, branch)
                absolute_files = [str(infra_path / file) for file in files]
                
                # Add each file individually
                for file in absolute_files:
                    worktree_repo.git.add(file)
            else:
                # Add all changes
                worktree_repo.git.add(A=True)
            
            # Check if there are changes to commit
            if not worktree_repo.is_dirty() and not worktree_repo.untracked_files:
                return CommitResult(
                    success=True,
                    message="No changes to commit",
                    commit_id=None,
                    branch=branch,
                    no_changes=True
                )  # type: ignore
            
            # Commit the changes
            commit = worktree_repo.index.commit(message)
            
            logger.info(f"Committed changes to branch {branch} with message: {message}")
            
            # Create and return the result
            return CommitResult(
                success=True,
                message="Changes committed successfully",
                commit_id=commit.hexsha,
                commit_message=message,
                branch=branch,
                no_changes=False,
                commit_date=commit.committed_datetime.isoformat()
            )  # type: ignore
            
        except GitCommandError as e:
            logger.error(f"Git error during commit: {str(e)}")
            return CommitResult(
                success=False,
                error=f"Git command failed: {str(e)}",
                message="Git command failed"
            )  # type: ignore
        except Exception as e:
            logger.error(f"Error committing changes: {str(e)}")
            return CommitResult(
                success=False,
                error=str(e),
                message="Commit operation failed"
            )  # type: ignore
    




    @staticmethod
    def check_branch_sync_status(project_id: str, branch_name: str, target_branch: Optional[str] = None) -> Dict[str, Any]:
        """
        Check if a branch is in sync with another branch (defaults to main)
        
        Returns sync status including ahead/behind counts and whether branches have diverged.
        """
        if target_branch is None:
            target_branch = GitService.MAIN_BRANCH
            
        try:
            repo = GitService.get_repository(project_id)
            if not repo:
                return {"success": False, "error": f"Project {project_id} is not a Git repository"}
            
            # Verify branches exist
            branch_names = [branch.name for branch in repo.branches]
            if branch_name not in branch_names:
                return {"success": False, "error": f"Branch '{branch_name}' does not exist"}
            if target_branch not in branch_names:
                return {"success": False, "error": f"Target branch '{target_branch}' does not exist"}
            
            # Count commits ahead and behind
            ahead_count = len(list(repo.iter_commits(f"{target_branch}..{branch_name}")))
            behind_count = len(list(repo.iter_commits(f"{branch_name}..{target_branch}")))
            
            # Determine sync status
            is_in_sync = behind_count == 0
            diverged = ahead_count > 0 and behind_count > 0
            
            # Status description
            if ahead_count == 0 and behind_count == 0:
                status = f"'{branch_name}' is up to date with '{target_branch}'"
            elif ahead_count > 0 and behind_count == 0:
                status = f"'{branch_name}' is ahead by {ahead_count} commit(s)"
            elif ahead_count == 0 and behind_count > 0:
                status = f"'{branch_name}' is behind by {behind_count} commit(s)"
            else:
                status = f"'{branch_name}' has diverged (ahead: {ahead_count}, behind: {behind_count})"
            
            return {
                "success": True,
                "is_in_sync": is_in_sync,
                "ahead_count": ahead_count,
                "behind_count": behind_count,
                "diverged": diverged,
                "status_description": status
            }
            
        except Exception as e:
            logger.error(f"Error checking branch sync status: {str(e)}")
            return {"success": False, "error": str(e)}
            
    @staticmethod 
    def sync_branch_with_target(project_id: str, branch_name: str, target_branch: Optional[str] = None) -> Dict[str, Any]:
        """
        Sync a branch with target branch using merge strategy
        """
        if target_branch is None:
            target_branch = GitService.MAIN_BRANCH
            
        try:
            # Check current sync status
            sync_status = GitService.check_branch_sync_status(project_id, branch_name, target_branch)
            if not sync_status.get("success", False):
                return sync_status
            
            # Return early if already in sync
            if sync_status.get("is_in_sync", False) and sync_status.get("behind_count", 0) == 0:
                return {
                    "success": True,
                    "message": f"Branch '{branch_name}' is already in sync",
                    "action_taken": "none"
                }
            
            # Get appropriate repo object (worktree for non-main branches)
            if branch_name != GitService.MAIN_BRANCH:
                worktree_path = GitService.get_worktree_root_path(project_id, branch_name)
                if not worktree_path:
                    return {"success": False, "error": f"Worktree not found for branch: {branch_name}"}
                branch_repo = Repo(worktree_path)
            else:
                branch_repo = GitService.get_repository(project_id)
                
            if not branch_repo:
                return {"success": False, "error": f"Could not access repository for branch: {branch_name}"}
            
            # Merge target branch into source branch
            branch_repo.git.merge(target_branch)
            
            logger.info(f"Synced branch '{branch_name}' with '{target_branch}'")
            
            return {
                "success": True,
                "message": f"Successfully merged '{target_branch}' into '{branch_name}'",
                "action_taken": "merge"
            }
            
        except Exception as e:
            logger.error(f"Error syncing branch: {str(e)}")
            return {"success": False, "error": str(e)}


            
    # Legacy method aliases for backward compatibility
    @staticmethod
    def create_branch(project_id: str, branch_name: str) -> Dict[str, Any]:
        """Legacy method - use create_branch_with_worktree instead"""
        return GitService.create_branch_with_worktree(project_id, branch_name)
    
    @staticmethod
    def delete_branch(project_id: str, branch_name: str) -> Dict[str, Any]:
        """Legacy method - use delete_branch_with_worktree instead"""
        return GitService.delete_branch_with_worktree(project_id, branch_name)


